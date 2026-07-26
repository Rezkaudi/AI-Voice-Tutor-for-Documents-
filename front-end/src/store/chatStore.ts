import { create } from "zustand";
import { streamChat } from "@/services/chatApi";
import { ChatStreamFatalError, runChatStream } from "./chatStreamRunner";
import { useDocumentStore } from "./documentStore";
import { useSessionStore } from "./sessionStore";
import { useSpeechStore } from "./speechStore";
import type { ChatMessage, DocumentReference } from "@/types";

interface SendMessageOptions {
  hidden?: boolean;
}

const MAX_CHAT_ATTEMPTS = 3;

function retryDelayMs(attempt: number): number {
  return Math.min(800 * 2 ** attempt, 4000);
}

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

interface ChatStore {
  messages: ChatMessage[];
  isStreaming: boolean;
  turnId: number;
  abort: () => void;
  resetMessages: () => void;
  sendMessage: (content: string, options?: SendMessageOptions) => Promise<void>;
}

function patchMessage(
  messages: ChatMessage[],
  id: string,
  patch: Partial<ChatMessage>
): ChatMessage[] {
  return messages.map((message) =>
    message.id === id ? { ...message, ...patch } : message
  );
}

export const useChatStore = create<ChatStore>((set, get) => {

  let abortController: AbortController | null = null;

  const patchAssistant = (id: string, patch: Partial<ChatMessage>) => {
    set({ messages: patchMessage(get().messages, id, patch) });
  };

  const applyReference = (id: string, reference: DocumentReference | null) => {
    useDocumentStore.getState().applyReference(reference);
    patchAssistant(id, { reference });
  };

  return {
    messages: [],
    isStreaming: false,
    turnId: 0,

    abort: () => {
      abortController?.abort();
      abortController = null;

      set({ isStreaming: false });
    },

    resetMessages: () => {
      abortController?.abort();
      abortController = null;
      set({ messages: [], isStreaming: false });
    },

    sendMessage: async (content, options = {}) => {
      const trimmed = content.trim();
      const loadedDocument = useDocumentStore.getState().loadedDocument;
      if (!loadedDocument || get().isStreaming || !trimmed) return;

      const session = useSessionStore.getState();
      session.setError(null);
      session.setPendingQuestion(null);
      useSpeechStore.getState().resumeThinkingCue();
      set({ isStreaming: true, turnId: get().turnId + 1 });

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        hidden: options.hidden
      };
      const assistantId = crypto.randomUUID();
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        reference: null
      };
      const history = get().messages.map(({ role, content }) => ({ role, content }));
      set({ messages: [...get().messages, userMessage, assistantMessage] });

      const controller = new AbortController();
      abortController = controller;

      const payload = {
        documentId: loadedDocument.document.id,
        message: trimmed,
        language: session.speechLanguage,
        messages: history,
        selectedPages: useSessionStore.getState().selectedPages,
        teacherAsks: useSessionStore.getState().teacherAsks
      };

      try {
        let lastError: unknown = null;

        for (let attempt = 0; attempt < MAX_CHAT_ATTEMPTS; attempt += 1) {
          if (controller.signal.aborted) return;

          if (attempt > 0) {
            // Reconnecting after a dropped stream: wipe the partial answer and
            // silence any half-played audio so the retry starts from a clean
            // slate — the learner never sees or hears the turn twice.
            useSpeechStore.getState().stopSpeaking();
            patchAssistant(assistantId, { content: "", reference: null });
            useSpeechStore.getState().resumeThinkingCue();
          }

          try {
            const body = await streamChat(payload, controller.signal);

            await runChatStream({
              body,
              speechSession: useSpeechStore.getState().createSpeechSession(),
              signal: controller.signal,
              onText: (text) => patchAssistant(assistantId, { content: text }),
              onReference: (reference) => applyReference(assistantId, reference),
              onFocusCitation: (citation) => useDocumentStore.getState().focusCitation(citation),
              onQuestion: (question) => useSessionStore.getState().setPendingQuestion(question),
              onEndSession: () => useSessionStore.getState().endCall()
            });

            useSessionStore.getState().maybeContinueCall();
            lastError = null;
            break;
          } catch (error) {
            if (controller.signal.aborted) return;
            lastError = error;

            // A server-reported error is a genuine failure — stop. Everything
            // else (dropped connection, QUIC reset) gets a bounded retry.
            const fatal = error instanceof ChatStreamFatalError;
            if (fatal || attempt === MAX_CHAT_ATTEMPTS - 1) break;

            await abortableSleep(retryDelayMs(attempt), controller.signal);
          }
        }

        if (lastError && !controller.signal.aborted) {
          useSpeechStore.getState().stopSpeaking();
          useSessionStore
            .getState()
            .setError(
              lastError instanceof Error ? lastError.message : "The teacher could not respond."
            );
          set({ messages: get().messages.filter((message) => message.id !== assistantId) });
        }
      } finally {
        if (abortController === controller) abortController = null;
        set({ isStreaming: false });
      }
    }
  };
});
