export class TextTokenizer {
  private static readonly STOP_WORDS = new Set([
    "a", "an", "and", "are", "as", "at", "be", "by", "do", "does", "for", "from",
    "how", "i", "in", "is", "it", "of", "on", "or", "that", "the", "this", "to",
    "what", "when", "where", "which", "who", "why"
  ]);

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
