// Latin, CJK and Arabic sentence-ending punctuation.
const HARD_TERMINATORS = "。！？…";
const ASCII_TERMINATORS = ".!?؟";

const MIN_SENTENCE_LENGTH = 2;

export type SentenceSplit = {
  sentences: string[];
  consumed: number;
};

/**
 * Pull every complete sentence out of a streaming buffer and report how many
 * characters were consumed, so the caller can keep speaking only the new tail.
 */
export function extractSentences(buffer: string): SentenceSplit {
  const sentences: string[] = [];
  let start = 0;
  let consumed = 0;

  for (let index = 0; index < buffer.length; index += 1) {
    if (!isSentenceBoundary(buffer, index)) {
      continue;
    }

    const piece = buffer.slice(start, index + 1).trim();
    if (piece.length >= MIN_SENTENCE_LENGTH) {
      sentences.push(piece);
      start = index + 1;
      consumed = index + 1;
    }
  }

  return { sentences, consumed };
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
