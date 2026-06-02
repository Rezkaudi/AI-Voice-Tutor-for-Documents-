import type { Span } from "@/domain/logic/citation/citation-types";
import type { TextNormalizer } from "@/domain/logic/citation/text-normalizer";
import type { TokenSimilarity } from "@/domain/logic/citation/token-similarity";

/**
 * Locates a verbatim quote inside its source page and returns its character
 * {@link Span}, trying progressively looser strategies:
 *
 *   1. exact substring — the fast path when the model quotes cleanly;
 *   2. whitespace-collapsed match, mapped back to original offsets;
 *   3. lowercased + punctuation-stripped match, then a token-set sliding window
 *      that rescues lightly paraphrased quotes above {@link FUZZY_MIN_SIMILARITY}.
 *
 * Returns `null` when nothing clears the floor, so the caller can drop the quote.
 */
export class QuoteLocator {
  private static readonly FUZZY_MIN_SIMILARITY = 0.82;

  constructor(
    private readonly normalizer: TextNormalizer,
    private readonly similarity: TokenSimilarity
  ) {}

  locate(pageText: string, quote: string): Span | null {
    const direct = pageText.indexOf(quote);
    if (direct !== -1) {
      return { start: direct, end: direct + quote.length };
    }
    return (
      this.matchCollapsed(pageText, this.normalizer.collapseWhitespace(quote)) ??
      this.matchLoose(pageText, quote)
    );
  }

  /** Strategy 2 — match after collapsing every whitespace run to one space. */
  private matchCollapsed(pageText: string, target: string): Span | null {
    if (!target) {
      return null;
    }
    const { normalized, offsets } = this.normalizer.collapseWithOffsets(pageText);
    let index = normalized.indexOf(target);
    if (index === -1) {
      index = normalized.toLowerCase().indexOf(target.toLowerCase());
    }
    if (index === -1) {
      return null;
    }
    return this.normalizer.mapToSpan(offsets, index, target.length, pageText.length);
  }

  /** Strategy 3 — loose substring, then a token-set similarity sliding window. */
  private matchLoose(pageText: string, quote: string): Span | null {
    const { normalized: looseQuote } = this.normalizer.looseWithOffsets(quote);
    if (!looseQuote) {
      return null;
    }
    const { normalized: loosePage, offsets } = this.normalizer.looseWithOffsets(pageText);

    const direct = loosePage.indexOf(looseQuote);
    if (direct !== -1) {
      return this.normalizer.mapToSpan(offsets, direct, looseQuote.length, pageText.length);
    }

    const quoteTokens = this.similarity.tokenize(quote);
    if (quoteTokens.size < 3) {
      return null;
    }
    const windowLength = Math.max(40, Math.min(looseQuote.length * 2, 600));
    const step = Math.max(20, Math.floor(windowLength / 4));
    let best: { score: number; index: number } | null = null;
    for (let i = 0; i + 10 < loosePage.length; i += step) {
      const sliceTokens = this.similarity.tokenize(loosePage.slice(i, i + windowLength));
      const score = this.similarity.jaccard(quoteTokens, sliceTokens);
      if (!best || score > best.score) {
        best = { score, index: i };
      }
    }
    if (!best || best.score < QuoteLocator.FUZZY_MIN_SIMILARITY) {
      return null;
    }
    return this.normalizer.mapToSpan(
      offsets,
      best.index,
      Math.min(windowLength, loosePage.length - best.index),
      pageText.length
    );
  }
}
