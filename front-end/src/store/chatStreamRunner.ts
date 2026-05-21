import { extractSentences } from "@/lib/sentences";
import { readEventStream } from "@/lib/sse";
import type { DocumentReference, SpeechSession } from "@/lib/types";

interface RunChatStreamDeps {
  body: ReadableStream<Uint8Array>;
  speechSession: SpeechSession;
  onText: (text: string) => void;
  onReference: (reference: DocumentReference | null) => void;
}

/**
 * Drains the chat SSE stream into `onText` updates, voicing each finished
 * sentence as it arrives, and waiting for TTS to drain before returning.
 */
export async function runChatStream({
  body,
  speechSession,
  onText,
  onReference
}: RunChatStreamDeps): Promise<string> {
  let assistantText = "";
  let spokenChars = 0;

  await readEventStream(body, (event) => {
    if (event.event === "meta") {
      onReference(event.data.reference);
      return;
    }

    if (event.event === "delta") {
      assistantText += event.data.text;
      onText(assistantText);

      // Speak each finished sentence as soon as it arrives, instead of
      // waiting for the whole answer to finish streaming.
      const { sentences, consumed } = extractSentences(assistantText.slice(spokenChars));
      if (consumed > 0) {
        spokenChars += consumed;
        sentences.forEach((sentence) => speechSession.push(sentence));
      }
      return;
    }

    if (event.event === "error") {
      throw new Error(event.data.error);
    }
  });

  const tail = assistantText.slice(spokenChars).trim();
  if (tail) speechSession.push(tail);
  await speechSession.finished();

  return assistantText;
}
