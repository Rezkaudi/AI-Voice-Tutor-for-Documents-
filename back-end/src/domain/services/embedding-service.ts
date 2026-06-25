export interface EmbeddingService {
  embedTexts(texts: string[]): Promise<(number[] | null)[]>;
  embedQuery(query: string): Promise<number[] | null>;
}
