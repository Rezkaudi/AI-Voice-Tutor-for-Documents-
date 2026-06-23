import { create } from "zustand";
import { streamChat } from "@/services/chatApi";
import { runChatStream } from "./chatStreamRunner";
import { useDocumentStore } from "./documentStore";
import { useSessionStore } from "./sessionStore";
import { useSpeechStore } from "./speechStore";
import type { ChatMessage, DocumentReference } from "@/types";

interface SendMessageOptions {
  hidden?: boolean;
}

interface ChatStore {
  messages: ChatMessage[];
  isStreaming: boolean;
  abort: () => void;
  resetMessages: () => void;
  sendMessage: (content: string, options?: SendMessageOptions) => Promise<void>;
}

/** Applies a partial patch to the message with the given id. */
function patchMessage(
  messages: ChatMessage[],
  id: string,
  patch: Partial<ChatMessage>
): ChatMessage[] {
  return messages.map((message) =>
    message.id === id ? { ...message, ...patch } : message
  );
}

/**
 * Chat store: streams answers from `/api/chat`, mirrors page references to
 * the document store, and feeds finished sentences to TTS as they arrive.
 */
export const useChatStore = create<ChatStore>((set, get) => {
  // Kept outside store state — it is transport plumbing, not UI state.
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

    /** Aborts the in-flight request, keeping any text streamed so far. */
    abort: () => {
      abortController?.abort();
      abortController = null;
      // Clear the flag now: the stream may be parked on TTS playback, where the
      // request controller no longer drives the `finally` that would reset it.
      set({ isStreaming: false });
    },

    resetMessages: () => {
      abortController?.abort();
      abortController = null;
      set({ messages: [], isStreaming: false });
    },

    /** Sends a learner message and streams the tutor's answer. */
    sendMessage: async (content, options = {}) => {
      const trimmed = content.trim();
      const loadedDocument = useDocumentStore.getState().loadedDocument;
      if (!loadedDocument || get().isStreaming || !trimmed) return;

      const session = useSessionStore.getState();
      session.setError(null);
      set({ isStreaming: true });

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

      try {
        const body = await streamChat(
          {
            documentId: loadedDocument.document.id,
            message: trimmed,
            language: session.speechLanguage,
            messages: history,
            selectedPages: useSessionStore.getState().selectedPages,
            saveCost: useSessionStore.getState().saveCost
          },
          controller.signal
        );

        await runChatStream({
          body,
          speechSession: useSpeechStore.getState().createSpeechSession(),
          onText: (text) => patchAssistant(assistantId, { content: text }),
          onReference: (reference) => applyReference(assistantId, reference),
          onFocusCitation: (citation) =>
            useDocumentStore.getState().focusCitation(citation)
        });

        useSessionStore.getState().maybeContinueCall();
      } catch (error) {
        if (controller.signal.aborted) {
          // Call ended mid-answer: drop the request silently and keep what
          // streamed so far instead of surfacing an error.
          return;
        }
        useSessionStore
          .getState()
          .setError(error instanceof Error ? error.message : "The teacher could not respond.");
        set({ messages: get().messages.filter((message) => message.id !== assistantId) });
      } finally {
        if (abortController === controller) abortController = null;
        set({ isStreaming: false });
      }
    }
  };
});
