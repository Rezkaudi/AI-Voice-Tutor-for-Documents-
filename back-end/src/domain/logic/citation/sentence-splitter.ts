import type { SentenceSpan } from "@/domain/logic/citation/citation-types";

export class SentenceSplitter {
  private static readonly MIN_SENTENCE_LENGTH = 20;
  private static readonly PATTERN = /[^.!?\n]+[.!?]+(?=\s|$)|[^.!?\n]+(?=\n|$)/g;

  split(text: string): SentenceSpan[] {
    const spans: SentenceSpan[] = [];
    for (const match of text.matchAll(SentenceSplitter.PATTERN)) {
      const raw = match[0];
      if (!raw) continue;
      const start = match.index ?? 0;
      const end = start + raw.length;
      const trimmedStart = start + (raw.length - raw.trimStart().length);
      const trimmedEnd = end - (raw.length - raw.trimEnd().length);
      if (trimmedEnd - trimmedStart < SentenceSplitter.MIN_SENTENCE_LENGTH) continue;
      spans.push({
        text: text.slice(trimmedStart, trimmedEnd),
        start: trimmedStart,
        end: trimmedEnd
      });
    }
    return spans;
  }
}
