import type { Span } from "@/domain/logic/citation/citation-types";
import type { TextNormalizer } from "@/domain/logic/citation/text-normalizer";
import type { TokenSimilarity } from "@/domain/logic/citation/token-similarity";

export class QuoteLocator {
  private static readonly FUZZY_MIN_SIMILARITY = 0.82;

  constructor(
    private readonly normalizer: TextNormalizer,
    private readonly similarity: TokenSimilarity
  ) { }

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
