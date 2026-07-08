const HARD_TERMINATORS = "。！？…";
const ASCII_TERMINATORS = ".!?؟";

const MIN_SENTENCE_LENGTH = 2;

/**
 * Cuts a streamed reply into speakable sentences as deltas arrive, so each
 * sentence can be synthesized the moment it completes. Stateful per turn.
 *
 * A boundary is a newline or hard CJK terminator, or an ASCII terminator
 * followed by whitespace. Bold spans are never split and trailing [[N]]
 * citation markers are absorbed into the sentence that cites them.
 */
export class SentenceStreamSegmenter {
  private buffer = "";

  /** Feeds one delta; returns the sentences it completed (often none). */
  push(delta: string): string[] {
    this.buffer += delta;
    const { sentences, consumed } = extractSentences(this.buffer);
    if (consumed > 0) {
      this.buffer = this.buffer.slice(consumed);
    }
    return sentences;
  }

  /** Returns the unterminated tail once the reply is complete. */
  flush(): string | null {
    const tail = this.buffer.trim();
    this.buffer = "";
    return tail.length >= MIN_SENTENCE_LENGTH ? tail : null;
  }
}

function extractSentences(buffer: string): { sentences: string[]; consumed: number } {
  const sentences: string[] = [];
  let start = 0;
  let consumed = 0;

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

function absorbTrailingMarkers(buffer: string, from: number): number | null {
  let cursor = from;
  for (;;) {
    let next = cursor;
    while (next < buffer.length && (buffer[next] === " " || buffer[next] === "\t")) {
      next += 1;
    }

    if (next >= buffer.length) return null;
    if (buffer[next] !== "[") return cursor;

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
  const char = buffer[index]!;

  if (char === "\n" || HARD_TERMINATORS.includes(char)) {
    return true;
  }

  if (ASCII_TERMINATORS.includes(char)) {
    const next = buffer[index + 1];
    return next !== undefined && /\s/.test(next);
  }

  return false;
}
