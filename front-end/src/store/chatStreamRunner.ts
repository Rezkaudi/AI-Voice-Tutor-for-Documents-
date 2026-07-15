import { readEventStream } from "@/lib/sse";
import type { DocumentCitation, DocumentReference, SpeechSession } from "@/types";

interface RunChatStreamDeps {
  body: ReadableStream<Uint8Array>;
  speechSession: SpeechSession;
  signal: AbortSignal;
  onText: (text: string) => void;
  onReference: (reference: DocumentReference | null) => void;
  onFocusCitation: (citation: DocumentCitation) => void;
  onQuestion: (question: string | null) => void;
  onEndSession: () => void;
}

interface PendingClip {
  text: string;
  markers: number[];
  parts: Uint8Array<ArrayBuffer>[];
}

export async function runChatStream({
  body,
  speechSession,
  signal,
  onText,
  onReference,
  onFocusCitation,
  onQuestion,
  onEndSession
}: RunChatStreamDeps): Promise<string> {
  let assistantText = "";
  let pendingQuestion: string | null = null;
  let endSession = false;

  const refBox: { current: DocumentReference | null } = { current: null };

  const pendingTimers: { current: number[] } = { current: [] };
  const pendingClips = new Map<number, PendingClip>();

  const playClip = (clip: PendingClip) => {
    const blob = clip.parts.length > 0 ? new Blob(clip.parts, { type: "audio/mpeg" }) : null;
    const utterance = { text: clip.text, clip: blob };
    if (clip.markers.length === 0) {
      speechSession.push(utterance);
      return;
    }
    speechSession.push(utterance, (durationMs) => {
      pendingTimers.current.forEach((id) => window.clearTimeout(id));
      pendingTimers.current = [];
      const citations = refBox.current?.citations ?? [];
      const focusAt = (n: number) => {
        const c = citations[n - 1];
        if (c) onFocusCitation(c);
      };
      focusAt(clip.markers[0]!);
      for (let i = 1; i < clip.markers.length; i += 1) {
        const delay = (durationMs * i) / clip.markers.length;
        const id = window.setTimeout(() => focusAt(clip.markers[i]!), delay);
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
      return;
    }

    if (event.event === "speech-start") {
      pendingClips.set(event.data.id, {
        text: event.data.text,
        markers: event.data.markers,
        parts: []
      });
      return;
    }

    if (event.event === "speech-chunk") {
      pendingClips.get(event.data.id)?.parts.push(decodeBase64(event.data.audio));
      return;
    }

    if (event.event === "speech-end") {
      const clip = pendingClips.get(event.data.id);
      pendingClips.delete(event.data.id);
      if (clip) playClip(clip);
      return;
    }

    if (event.event === "question") {
      pendingQuestion = event.data.text.trim() || null;
      return;
    }

    if (event.event === "end-session") {
      endSession = true;
      return;
    }

    if (event.event === "error") {
      throw new Error(event.data.error);
    }
  });

  await speechSession.finished();
  pendingTimers.current.forEach((id) => window.clearTimeout(id));

  if (signal.aborted) return assistantText;

  if (endSession) {
    onEndSession();
    return assistantText;
  }

  onQuestion(pendingQuestion);

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

function decodeBase64(encoded: string): Uint8Array<ArrayBuffer> {
  const binary = window.atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

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
