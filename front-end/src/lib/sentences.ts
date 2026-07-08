
const HARD_TERMINATORS = "。！？…";
const ASCII_TERMINATORS = ".!?؟";
const SOFT_SPEECH_TERMINATORS = ",;:،؛，、";

const MIN_SENTENCE_LENGTH = 2;
const EARLY_SPEECH_MIN_CHARS = 32;
const EARLY_SPEECH_MIN_WORDS = 6;

export function extractSentences(buffer: string): { sentences: string[]; consumed: number } {
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

export function extractSpeechSegments(
  buffer: string,
  options: { allowEarlySegment?: boolean } = {}
): { sentences: string[]; consumed: number } {
  const strict = extractSentences(buffer);
  if (strict.consumed > 0 || !options.allowEarlySegment) return strict;

  const early = extractEarlySpeechSegment(buffer);
  return early ? { sentences: [early.text], consumed: early.consumed } : strict;
}

function extractEarlySpeechSegment(
  buffer: string
): { text: string; consumed: number } | null {
  const trimmedStart = firstNonWhitespaceIndex(buffer);
  if (trimmedStart === null) return null;

  const source = buffer.slice(trimmedStart);
  if (source.length < EARLY_SPEECH_MIN_CHARS) return null;

  let inBold = false;
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "*" && source[index + 1] === "*") {
      inBold = !inBold;
      index += 1;
      continue;
    }

    if (!inBold && SOFT_SPEECH_TERMINATORS.includes(source[index]!)) {
      const end = index + 1;
      const piece = source.slice(0, end).trim();
      if (isLongEnoughEarlySegment(piece)) {
        return { text: piece, consumed: trimmedStart + end };
      }
    }
  }

  const words = Array.from(source.matchAll(/\S+/g));
  if (words.length < EARLY_SPEECH_MIN_WORDS) return null;

  const boundaryWord = words[EARLY_SPEECH_MIN_WORDS - 1]!;
  const consumed = trimmedStart + (boundaryWord.index ?? 0) + boundaryWord[0].length;
  const piece = buffer.slice(trimmedStart, consumed).trim();
  if (!isLongEnoughEarlySegment(piece)) return null;

  return { text: piece, consumed };
}

function firstNonWhitespaceIndex(value: string): number | null {
  const match = /\S/.exec(value);
  return match?.index ?? null;
}

function isLongEnoughEarlySegment(value: string): boolean {
  return (
    value.length >= EARLY_SPEECH_MIN_CHARS &&
    Array.from(value.matchAll(/\S+/g)).length >= EARLY_SPEECH_MIN_WORDS
  );
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
  const char = buffer[index];

  if (char === "\n" || HARD_TERMINATORS.includes(char)) {
    return true;
  }

  if (ASCII_TERMINATORS.includes(char)) {
    const next = buffer[index + 1];
    return next !== undefined && /\s/.test(next);
  }

  return false;
}
