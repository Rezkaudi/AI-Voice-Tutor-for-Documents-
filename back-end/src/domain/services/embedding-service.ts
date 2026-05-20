/**
 * Text-embedding boundary. Used to vectorise document chunks (background job)
 * and learner queries (the tutor's `search_document` tool).
 */
export interface EmbeddingService {
  /** True when an embedding provider is configured. */
  isAvailable(): boolean;

  /**
   * Embeds many texts at once. Returns one vector per input, in order, or
   * `null` in a slot when embedding is unavailable or failed.
   */
  embedTexts(texts: string[]): Promise<(number[] | null)[]>;

  /** Embeds a single query string, or returns `null` when unavailable. */
  embedQuery(query: string): Promise<number[] | null>;
}
