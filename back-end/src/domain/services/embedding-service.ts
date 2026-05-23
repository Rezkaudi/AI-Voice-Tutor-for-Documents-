/**
 * Text-embedding boundary. Used to vectorise document chunks (background job)
 * and learner queries (the tutor's `search_document` tool).
 */
export interface EmbeddingService {
  /**
   * Embeds many texts at once. Returns one vector per input, in order, or
   * `null` in a slot when embedding failed for that text.
   */
  embedTexts(texts: string[]): Promise<(number[] | null)[]>;

  /** Embeds a single query string, or returns `null` on failure. */
  embedQuery(query: string): Promise<number[] | null>;
}
