/**
 * Unicode-aware word-set similarity used by the fuzzy quote matcher.
 *
 * Quotes the model paraphrases or lightly edits won't match as substrings, but
 * they still share most of their words; {@link jaccard} over {@link tokenize}
 * sets gives a cheap overlap score for the sliding-window search.
 */
export class TokenSimilarity {
  /** Lowercased word set, dropping tokens of 2 chars or fewer. */
  tokenize(value: string): Set<string> {
    return new Set(
      value
        .toLowerCase()
        .match(/[\p{L}\p{N}]+/gu)
        ?.filter((word) => word.length > 2) ?? []
    );
  }

  /** Jaccard index |a ∩ b| / |a ∪ b|; 0 when either set is empty. */
  jaccard(a: Set<string>, b: Set<string>): number {
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
}
