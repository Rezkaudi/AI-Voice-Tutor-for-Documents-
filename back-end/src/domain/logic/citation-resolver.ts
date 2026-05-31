import type { Citation } from "@/domain/entities/chat";
import type { DocumentPage } from "@/domain/entities/document";
import type { TextTokenizer } from "@/domain/logic/text-tokenizer";

/**
 * Resolves verbatim quotes back to character offsets in their source page, and
 * synthesises citations from an answer when the model recorded none.
 *
 * The tutor's `cite_passages` tool gives us `{ page, quote }`; the renderer
 * needs `{ start, end }` to wrap the matching glyphs in the PDF.js text layer.
 * {@link resolve} tries four match strategies in order — exact, whitespace-
 * normalised, lowercased + punctuation-stripped, then a sliding fuzzy window —
 * and drops the quote if none clear the similarity floor. {@link autoCiteFromAnswer}
 * is the last-resort fallback when the model skips `cite_passages` entirely.
 */
export interface CitationCandidate {
  pageNumber: number;
  quote: string;
}

interface Span {
  start: number;
  end: number;
}

interface SentenceSpan {
  text: string;
  start: number;
  end: number;
}

export class CitationResolver {
  private static readonly MIN_QUOTE_LENGTH = 8;
  private static readonly FUZZY_MIN_SIMILARITY = 0.82;

  constructor(private readonly tokenizer: TextTokenizer) {}

  /** Maps verbatim quotes to `{ pageNumber, start, end }` spans on their page. */
  resolve(
    candidates: ReadonlyArray<CitationCandidate>,
    pages: ReadonlyArray<DocumentPage>
  ): Citation[] {
    const pageByNumber = new Map<number, DocumentPage>();
    for (const page of pages) {
      pageByNumber.set(page.pageNumber, page);
    }

    const resolved: Citation[] = [];
    const seen = new Set<string>();

    for (const candidate of candidates) {
      const page = pageByNumber.get(candidate.pageNumber);
      const quote = candidate.quote?.trim();
      if (!page || !quote || quote.length < CitationResolver.MIN_QUOTE_LENGTH) {
        continue;
      }
      const span = this.locateQuote(page.text, quote);
      if (!span) {
        continue;
      }
      const key = `${page.pageNumber}:${span.start}:${span.end}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      resolved.push({
        pageNumber: page.pageNumber,
        start: span.start,
        end: span.end,
        quote: page.text.slice(span.start, span.end)
      });
    }

    return resolved;
  }

  /**
   * Last-resort fallback when the model skips `cite_passages` (the save-cost
   * model frequently does). Splits the cited page into sentences, scores each
   * against the tutor's spoken answer using keyword overlap, and returns the
   * top scorers as synthesised citations so the UI still has something to
   * highlight. Returns `[]` when nothing clears the floor.
   */
  autoCiteFromAnswer(
    answer: string,
    page: DocumentPage,
    maxCitations: number = 2
  ): Citation[] {
    const answerTerms = new Set(this.tokenizer.tokenize(answer));
    if (answerTerms.size === 0) {
      return [];
    }
    const sentences = this.splitIntoSentences(page.text);
    if (sentences.length === 0) {
      return [];
    }

    const scored = sentences
      .map((sentence) => {
        const terms = new Set(this.tokenizer.tokenize(sentence.text));
        let overlap = 0;
        for (const term of terms) {
          if (answerTerms.has(term)) overlap += 1;
        }
        // Normalise by sentence size so a single long sentence does not always
        // win on raw count alone.
        const score = terms.size === 0 ? 0 : overlap / Math.sqrt(terms.size);
        return { sentence, overlap, score };
      })
      .filter((entry) => entry.overlap >= 2)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxCitations);

    return scored.map((entry) => ({
      pageNumber: page.pageNumber,
      start: entry.sentence.start,
      end: entry.sentence.end,
      quote: page.text.slice(entry.sentence.start, entry.sentence.end)
    }));
  }

  private locateQuote(pageText: string, quote: string): Span | null {
    // 1. Exact substring — by far the fast path when the model behaves.
    const direct = pageText.indexOf(quote);
    if (direct !== -1) {
      return { start: direct, end: direct + quote.length };
    }

    // 2. Whitespace-collapsed match, mapped back to original offsets.
    const collapsedTarget = this.collapseWhitespace(quote);
    const collapsedSpan = this.matchCollapsed(pageText, collapsedTarget);
    if (collapsedSpan) {
      return collapsedSpan;
    }

    // 3. Loose match: lowercase + strip punctuation, sliding window over loose
    //    page text aligned back to original offsets.
    const looseSpan = this.matchLoose(pageText, quote);
    if (looseSpan) {
      return looseSpan;
    }

    return null;
  }

  private collapseWhitespace(value: string): string {
    return value.replace(/\s+/g, " ").trim();
  }

  /** Match after collapsing every whitespace run to a single space. */
  private matchCollapsed(pageText: string, collapsedTarget: string): Span | null {
    if (!collapsedTarget) {
      return null;
    }
    const { collapsed, offsets } = this.collapseWithOffsets(pageText);
    const index = collapsed.indexOf(collapsedTarget);
    if (index === -1) {
      const lowerIndex = collapsed
        .toLowerCase()
        .indexOf(collapsedTarget.toLowerCase());
      if (lowerIndex === -1) {
        return null;
      }
      return this.offsetSpan(
        offsets,
        lowerIndex,
        collapsedTarget.length,
        pageText.length
      );
    }
    return this.offsetSpan(offsets, index, collapsedTarget.length, pageText.length);
  }

  private offsetSpan(
    offsets: number[],
    collapsedStart: number,
    collapsedLength: number,
    pageLength: number
  ): Span | null {
    const start = offsets[collapsedStart];
    const endIndex = collapsedStart + collapsedLength - 1;
    if (start === undefined || endIndex >= offsets.length) {
      return null;
    }
    const lastChar = offsets[endIndex];
    if (lastChar === undefined) {
      return null;
    }
    return { start, end: Math.min(pageLength, lastChar + 1) };
  }

  /**
   * Returns `pageText` with each whitespace run collapsed to a single space, plus
   * a parallel `offsets` array mapping each collapsed-string index back to the
   * original-string index of that character.
   */
  private collapseWithOffsets(pageText: string): {
    collapsed: string;
    offsets: number[];
  } {
    let collapsed = "";
    const offsets: number[] = [];
    let inWhitespace = false;
    for (let i = 0; i < pageText.length; i += 1) {
      const char = pageText[i]!;
      if (/\s/.test(char)) {
        if (!inWhitespace && collapsed.length > 0) {
          collapsed += " ";
          offsets.push(i);
        }
        inWhitespace = true;
      } else {
        collapsed += char;
        offsets.push(i);
        inWhitespace = false;
      }
    }
    // Trim trailing space.
    if (collapsed.endsWith(" ")) {
      collapsed = collapsed.slice(0, -1);
      offsets.pop();
    }
    return { collapsed, offsets };
  }

  /**
   * Fuzzy fallback: strips punctuation and case from both sides, then tries the
   * loose substring. If that fails, slides a window across the page comparing
   * token sets and returns the best position above the similarity floor.
   */
  private matchLoose(pageText: string, quote: string): Span | null {
    const { loose: looseQuote } = this.looseWithOffsets(quote);
    if (!looseQuote) {
      return null;
    }
    const { loose: loosePage, offsets } = this.looseWithOffsets(pageText);

    const direct = loosePage.indexOf(looseQuote);
    if (direct !== -1) {
      return this.offsetSpan(offsets, direct, looseQuote.length, pageText.length);
    }

    // Token-set similarity sliding window. Coarse but rescues paraphrased quotes
    // that share most words.
    const quoteTokens = this.looseTokens(quote);
    if (quoteTokens.size < 3) {
      return null;
    }
    const windowLength = Math.max(40, Math.min(looseQuote.length * 2, 600));
    const step = Math.max(20, Math.floor(windowLength / 4));
    let best: { score: number; index: number } | null = null;
    for (let i = 0; i + 10 < loosePage.length; i += step) {
      const slice = loosePage.slice(i, i + windowLength);
      const sliceTokens = this.looseTokens(slice);
      const score = this.jaccard(quoteTokens, sliceTokens);
      if (!best || score > best.score) {
        best = { score, index: i };
      }
    }
    if (!best || best.score < CitationResolver.FUZZY_MIN_SIMILARITY) {
      return null;
    }
    return this.offsetSpan(
      offsets,
      best.index,
      Math.min(windowLength, loosePage.length - best.index),
      pageText.length
    );
  }

  private looseWithOffsets(value: string): { loose: string; offsets: number[] } {
    let loose = "";
    const offsets: number[] = [];
    let inGap = true;
    for (let i = 0; i < value.length; i += 1) {
      const char = value[i]!;
      if (/[\p{L}\p{N}]/u.test(char)) {
        loose += char.toLowerCase();
        offsets.push(i);
        inGap = false;
      } else if (!inGap) {
        loose += " ";
        offsets.push(i);
        inGap = true;
      }
    }
    if (loose.endsWith(" ")) {
      loose = loose.slice(0, -1);
      offsets.pop();
    }
    return { loose, offsets };
  }

  /** Unicode-aware word set used by the fuzzy sliding window. */
  private looseTokens(value: string): Set<string> {
    return new Set(
      value
        .toLowerCase()
        .match(/[\p{L}\p{N}]+/gu)
        ?.filter((word) => word.length > 2) ?? []
    );
  }

  private jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) {
      return 0;
    }
    let intersection = 0;
    for (const value of a) {
      if (b.has(value)) intersection += 1;
    }
    const union = a.size + b.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }

  /** Splits page text into sentence-like spans with offsets into the original. */
  private splitIntoSentences(text: string): SentenceSpan[] {
    const spans: SentenceSpan[] = [];
    const pattern = /[^.!?\n]+[.!?]+(?=\s|$)|[^.!?\n]+(?=\n|$)/g;
    for (const match of text.matchAll(pattern)) {
      const raw = match[0];
      if (!raw) continue;
      const start = match.index ?? 0;
      const end = start + raw.length;
      const trimmedStart = start + (raw.length - raw.trimStart().length);
      const trimmedEnd = end - (raw.length - raw.trimEnd().length);
      if (trimmedEnd - trimmedStart < 20) continue;
      spans.push({
        text: text.slice(trimmedStart, trimmedEnd),
        start: trimmedStart,
        end: trimmedEnd
      });
    }
    return spans;
  }
}
