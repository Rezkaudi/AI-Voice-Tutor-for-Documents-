import { extractSentences } from "@/lib/sentences";
import { readEventStream } from "@/lib/sse";
import type { DocumentCitation, DocumentReference, SpeechSession } from "@/types";

interface RunChatStreamDeps {
  body: ReadableStream<Uint8Array>;
  speechSession: SpeechSession;
  onText: (text: string) => void;
  onReference: (reference: DocumentReference | null) => void;
  onFocusCitation: (citation: DocumentCitation) => void;
  onQuestion: (question: string | null) => void;
}

/**
 * Drains the chat SSE stream into `onText` updates, voicing each finished
 * sentence as it arrives, and waiting for TTS to drain before returning.
 */
export async function runChatStream({
  body,
  speechSession,
  onText,
  onReference,
  onFocusCitation,
  onQuestion
}: RunChatStreamDeps): Promise<string> {
  let assistantText = "";
  let spokenChars = 0;
  let pendingQuestion: string | null = null;
  // Box around the reference so TS keeps the union type across the await
  // boundary even though the callback may reassign it.
  const refBox: { current: DocumentReference | null } = { current: null };
  // Tracks setTimeout ids scheduled by the previous sentence so the next
  // sentence can supersede them — prevents an old sentence's later citation
  // from firing after the next sentence has already taken over the document.
  const pendingTimers: { current: number[] } = { current: [] };

  const pushSentence = (sentence: string) => {
    const spoken = stripCitationMarkers(sentence);
    if (!spoken) return;
    const indices = uniqueMarkerIndices(sentence);
    if (indices.length === 0) {
      // Keep the previous citation focused — natural while the tutor elaborates.
      speechSession.push(spoken);
      return;
    }
    speechSession.push(spoken, (durationMs) => {
      pendingTimers.current.forEach((id) => window.clearTimeout(id));
      pendingTimers.current = [];
      const citations = refBox.current?.citations ?? [];
      const focusAt = (n: number) => {
        const c = citations[n - 1];
        if (c) onFocusCitation(c);
      };
      focusAt(indices[0]!);
      for (let i = 1; i < indices.length; i += 1) {
        const delay = (durationMs * i) / indices.length;
        const id = window.setTimeout(() => focusAt(indices[i]!), delay);
        pendingTimers.current.push(id);
      }
    });
  };

  await readEventStream(body, (event) => {
    if (event.event === "meta") {
      refBox.current = event.data.reference;
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
        sentences.forEach(pushSentence);
      }
      return;
    }

    if (event.event === "question") {
      pendingQuestion = event.data.text.trim() || null;
      return;
    }

    if (event.event === "error") {
      throw new Error(event.data.error);
    }
  });

  const tail = assistantText.slice(spokenChars).trim();
  if (tail) pushSentence(tail);
  await speechSession.finished();
  pendingTimers.current.forEach((id) => window.clearTimeout(id));
  onQuestion(pendingQuestion);

  // After streaming ends, drop any citation the final text never referenced
  // with a [[N]] marker, and renumber the surviving markers so the side panel
  // matches what's clickable in the bubble. Safety net for cases the backend
  // reconcile missed (older bundle, restart lag, etc.).
  const finalReference = refBox.current;
  if (finalReference && finalReference.citations.length > 0) {
    const aligned = reconcileMarkers(assistantText, finalReference);
    if (aligned.text !== assistantText) {
      assistantText = aligned.text;
      onText(assistantText);
    }
    if (aligned.reference !== finalReference) onReference(aligned.reference);
  }

  return assistantText;
}

/** [[N]] reference markers are visual-only — strip before sending to TTS. */
function stripCitationMarkers(text: string): string {
  return text.replace(/\[\[\d+\]\]/g, "").replace(/[ \t]{2,}/g, " ");
}

/** Citation indices referenced in a sentence, in order, de-duplicated. */
function uniqueMarkerIndices(sentence: string): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const m of sentence.matchAll(/\[\[(\d+)\]\]/g)) {
    const n = Number(m[1]);
    if (n >= 1 && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

/**
 * Drops citations the text never marks with [[N]], renumbers the surviving
 * markers contiguously, and rewrites the text to match. Returns the original
 * objects when nothing changes so callers can skip a redundant re-render.
 */
function reconcileMarkers(
  text: string,
  reference: DocumentReference
): { text: string; reference: DocumentReference } {
  const used: number[] = [];
  let sawOutOfRange = false;
  for (const m of text.matchAll(/\[\[(\d+)\]\]/g)) {
    const n = Number(m[1]);
    if (n < 1 || n > reference.citations.length) {
      sawOutOfRange = true;
      continue;
    }
    if (!used.includes(n)) used.push(n);
  }
  const alreadyAligned =
    !sawOutOfRange &&
    used.length === reference.citations.length &&
    used.every((n, i) => n === i + 1);
  if (alreadyAligned) return { text, reference };
  const remap = new Map<number, number>();
  used.forEach((oldIdx, i) => remap.set(oldIdx, i + 1));
  const remappedText = text.replace(/\[\[(\d+)\]\]/g, (_, raw) => {
    const next = remap.get(Number(raw));
    return next ? `[[${next}]]` : "";
  });
  const remappedCitations = used.map((oldIdx) => reference.citations[oldIdx - 1]!);
  return {
    text: remappedText,
    reference: { ...reference, citations: remappedCitations }
  };
}
