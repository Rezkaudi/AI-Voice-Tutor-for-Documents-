import { useCallback, useRef, useState } from "react";
import { extractSentences } from "@/lib/sentences";
import { readEventStream } from "@/lib/sse";
import type { Reference } from "@/lib/types";
import type { LoadedDocument, UiMessage } from "@/components/teaching/types";
import type { SpeechController } from "./use-speech";

const MAX_HISTORY_MESSAGES = 10;

type SendOptions = { hidden?: boolean };

type UseTutorChatParams = {
  loadedDocument: LoadedDocument | null;
  speech: SpeechController;
  getLanguage: () => string;
  onReference: (reference: Reference | null) => void;
  onError: (message: string | null) => void;
  onAnswerComplete: () => void;
};

export type TutorChat = {
  messages: UiMessage[];
  isStreaming: boolean;
  sendMessage: (content: string, options?: SendOptions) => Promise<void>;
  resetMessages: () => void;
  /** Aborts the in-flight `/api/chat` request, keeping any text streamed so far. */
  abort: () => void;
};

/**
 * Owns the tutor conversation: streams answers from `/api/chat`, mirrors page
 * references back to the caller, and feeds finished sentences to text-to-speech
 * as they arrive.
 */
export function useTutorChat({
  loadedDocument,
  speech,
  getLanguage,
  onReference,
  onError,
  onAnswerComplete
}: UseTutorChatParams): TutorChat {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesRef = useRef<UiMessage[]>([]);
  messagesRef.current = messages;
  const abortRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const resetMessages = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(
    async (content: string, options: SendOptions = {}) => {
      const trimmed = content.trim();
      if (!loadedDocument || isStreaming || !trimmed) {
        return;
      }

      onError(null);
      setIsStreaming(true);

      const userMessage: UiMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        hidden: options.hidden
      };
      const assistantId = crypto.randomUUID();
      const assistantMessage: UiMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        reference: null
      };
      const history = messagesRef.current.map(({ role, content }) => ({ role, content }));
      setMessages((current) => [...current, userMessage, assistantMessage]);

      let assistantText = "";

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            documentId: loadedDocument.document.id,
            message: trimmed,
            language: getLanguage(),
            messages: history
          }),
          signal: controller.signal
        });

        if (!response.ok || !response.body) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "The teacher could not respond.");
        }

        const session = speech.createSpeechSession();
        let spokenChars = 0;

        await readEventStream(response.body, (event) => {
          if (event.event === "meta") {
            onReference(event.data.reference);
            setMessages((current) =>
              patchMessage(current, assistantId, { reference: event.data.reference })
            );
          }

          if (event.event === "delta") {
            assistantText += event.data.text;
            setMessages((current) =>
              patchMessage(current, assistantId, { content: assistantText })
            );

            // Speak each finished sentence as soon as it arrives, instead of
            // waiting for the whole answer to finish streaming.
            if (session) {
              const { sentences, consumed } = extractSentences(
                assistantText.slice(spokenChars)
              );
              if (consumed > 0) {
                spokenChars += consumed;
                sentences.forEach((sentence) => session.push(sentence));
              }
            }
          }

          if (event.event === "error") {
            throw new Error(event.data.error);
          }
        });

        if (session) {
          const tail = assistantText.slice(spokenChars).trim();
          if (tail) {
            session.push(tail);
          }
          await session.finished();
        }

        onAnswerComplete();
      } catch (error) {
        if (controller.signal.aborted) {
          // Call ended mid-answer: drop the request silently and keep what
          // streamed so far instead of surfacing an error.
          return;
        }
        onError(error instanceof Error ? error.message : "The teacher could not respond.");
        setMessages((current) => current.filter((message) => message.id !== assistantId));
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        setIsStreaming(false);
      }
    },
    [
      getLanguage,
      isStreaming,
      loadedDocument,
      onAnswerComplete,
      onError,
      onReference,
      speech
    ]
  );

  return { messages, isStreaming, sendMessage, resetMessages, abort };
}

function patchMessage(
  messages: UiMessage[],
  id: string,
  patch: Partial<UiMessage>
): UiMessage[] {
  return messages.map((message) =>
    message.id === id ? { ...message, ...patch } : message
  );
}
