/**
 * Turns free text into lowercased, de-duplicated, de-noised content terms.
 *
 * A single shared tokenizer keeps keyword ranking ({@link ChunkRanker}) and the
 * answer-based citation fallback ({@link CitationResolver}) scoring against the
 * same notion of a "word", so their relevance judgements stay consistent.
 */
export class TextTokenizer {
  private static readonly STOP_WORDS = new Set([
    "a", "an", "and", "are", "as", "at", "be", "by", "do", "does", "for", "from",
    "how", "i", "in", "is", "it", "of", "on", "or", "that", "the", "this", "to",
    "what", "when", "where", "which", "who", "why"
  ]);

  /** Lowercased, de-duplicated, de-noised content terms of a string. */
  tokenize(value: string): string[] {
    return Array.from(
      new Set(
        value
          .toLowerCase()
          .match(/[a-z0-9]+/g)
          ?.filter(
            (term) => term.length > 1 && !TextTokenizer.STOP_WORDS.has(term)
          ) ?? []
      )
    );
  }
}
