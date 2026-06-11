// Latin, CJK and Arabic sentence-ending punctuation.
const HARD_TERMINATORS = "。！？…";
const ASCII_TERMINATORS = ".!?؟";

const MIN_SENTENCE_LENGTH = 2;

/**
 * Pull every complete sentence out of a streaming buffer and report how many
 * characters were consumed, so the caller can keep speaking only the new tail.
 *
 * @param {string} buffer
 * @returns {{ sentences: string[], consumed: number }}
 */
export function extractSentences(buffer: string): { sentences: string[]; consumed: number } {
  const sentences: string[] = [];
  let start = 0;
  let consumed = 0;
  // Whether the scan is inside a `**bold**` span. The tutor bolds whole
  // quoted sentences ("**嘘だろう？**"), so a terminator inside the span must
  // not split it — that would orphan the markers across two sentences and
  // break both caption styling and TTS prosody. If the closing `**` hasn't
  // streamed in yet, we simply wait, same as for a half-streamed `[[1`.
  let inBold = false;

  for (let index = 0; index < buffer.length; index += 1) {
    if (buffer[index] === "*" && buffer[index + 1] === "*") {
      inBold = !inBold;
      index += 1;
      continue;
    }
    if (inBold || !isSentenceBoundary(buffer, index)) {
      continue;
    }

    // The tutor places [[N]] citation markers AFTER the terminating period —
    // pull any trailing markers (and the whitespace between them) into this
    // sentence so playback sync can read which citation it grounds. Bail if
    // the buffer ends mid-marker so we don't commit a half-streamed `[[1`.
    const absorbed = absorbTrailingMarkers(buffer, index + 1);
    if (absorbed === null) {
      break;
    }
    const end = absorbed;

    const piece = buffer.slice(start, end).trim();
    if (piece.length >= MIN_SENTENCE_LENGTH) {
      sentences.push(piece);
      start = end;
      consumed = end;
      index = end - 1;
    }
  }

  return { sentences, consumed };
}

/**
 * Skip past any trailing `[[N]]` markers (and the whitespace between them).
 * Returns the index after the last absorbed marker, or null if the buffer
 * may still be hiding an incoming marker — the tutor places markers AFTER
 * the period, so committing too early would attach the marker to the next
 * sentence and mis-sync per-sentence focus.
 */
function absorbTrailingMarkers(buffer: string, from: number): number | null {
  let cursor = from;
  for (;;) {
    let next = cursor;
    while (next < buffer.length && (buffer[next] === " " || buffer[next] === "\t")) {
      next += 1;
    }
    // Ran out of stream after the boundary — a marker may be on the way.
    if (next >= buffer.length) return null;
    if (buffer[next] !== "[") return cursor;
    // Saw `[` but the second `[` hasn't streamed yet — wait, don't commit.
    if (next + 1 >= buffer.length) return null;
    if (buffer[next + 1] !== "[") return cursor;
    const close = buffer.indexOf("]]", next + 2);
    if (close === -1) return null;
    const inside = buffer.slice(next + 2, close);
    if (!/^\d+$/.test(inside)) return cursor;
    cursor = close + 2;
  }
}

function isSentenceBoundary(buffer: string, index: number): boolean {
  const char = buffer[index];

  if (char === "\n" || HARD_TERMINATORS.includes(char)) {
    return true;
  }

  // Only break on ASCII punctuation once the following character has streamed
  // in and is whitespace — this avoids splitting "3.5" or a half-streamed token.
  if (ASCII_TERMINATORS.includes(char)) {
    const next = buffer[index + 1];
    return next !== undefined && /\s/.test(next);
  }

  return false;
}
