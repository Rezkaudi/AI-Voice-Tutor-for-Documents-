import type { Span } from "@/domain/logic/citation/citation-types";

/**
 * Produces normalised views of page text alongside an `offsets` array that maps
 * every normalised-string index back to its original-string index.
 *
 * Quote matching happens against the normalised text (whitespace-collapsed, or
 * lowercased + punctuation-stripped); {@link mapToSpan} then translates a match
 * found there into a {@link Span} over the *original* text, so the renderer
 * always highlights the real glyphs.
 */
export class TextNormalizer {
  /** Collapses every whitespace run in a standalone string to one space. */
  collapseWhitespace(value: string): string {
    return value.replace(/\s+/g, " ").trim();
  }

  /** Original text with whitespace runs collapsed to a single space, + offsets. */
  collapseWithOffsets(text: string): { normalized: string; offsets: number[] } {
    let normalized = "";
    const offsets: number[] = [];
    let inWhitespace = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i]!;
      if (/\s/.test(char)) {
        if (!inWhitespace && normalized.length > 0) {
          normalized += " ";
          offsets.push(i);
        }
        inWhitespace = true;
      } else {
        normalized += char;
        offsets.push(i);
        inWhitespace = false;
      }
    }
    return this.trimTrailingSpace(normalized, offsets);
  }

  /** Lowercased, punctuation-stripped view (gaps become single spaces), + offsets. */
  looseWithOffsets(text: string): { normalized: string; offsets: number[] } {
    let normalized = "";
    const offsets: number[] = [];
    let inGap = true;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i]!;
      if (/[\p{L}\p{N}]/u.test(char)) {
        normalized += char.toLowerCase();
        offsets.push(i);
        inGap = false;
      } else if (!inGap) {
        normalized += " ";
        offsets.push(i);
        inGap = true;
      }
    }
    return this.trimTrailingSpace(normalized, offsets);
  }

  /** Maps a `[start, length)` range in normalised space to a {@link Span}. */
  mapToSpan(
    offsets: number[],
    normalizedStart: number,
    normalizedLength: number,
    pageLength: number
  ): Span | null {
    const start = offsets[normalizedStart];
    const endIndex = normalizedStart + normalizedLength - 1;
    if (start === undefined || endIndex >= offsets.length) {
      return null;
    }
    const lastChar = offsets[endIndex];
    if (lastChar === undefined) {
      return null;
    }
    return { start, end: Math.min(pageLength, lastChar + 1) };
  }

  private trimTrailingSpace(
    normalized: string,
    offsets: number[]
  ): { normalized: string; offsets: number[] } {
    if (normalized.endsWith(" ")) {
      return { normalized: normalized.slice(0, -1), offsets: offsets.slice(0, -1) };
    }
    return { normalized, offsets };
  }
}
