import type { DocumentChunk } from "@/domain/entities/document";
import type { TextTokenizer } from "@/domain/logic/text-tokenizer";

/**
 * Ranks document chunks against a query — keyword + vector scoring.
 *
 * The tutor's `search_document` tool ranks chunks through {@link rank}, blending
 * an embedding cosine score (when embeddings are available) with a keyword score
 * so retrieval still works before the background embedding job has finished.
 *
 * Pure: no network, no framework — chunks in, ranked chunks out.
 */
export interface RankedChunk {
  chunk: DocumentChunk;
  score: number;
}

export class ChunkRanker {
  constructor(private readonly tokenizer: TextTokenizer) {}

  /** Ranks chunks against a query, best match first. */
  rank(
    query: string,
    chunks: DocumentChunk[],
    queryEmbedding?: number[] | null
  ): RankedChunk[] {
    const terms = this.tokenizer.tokenize(query);
    const ranked = chunks
      .map((chunk) => {
        const keyword = this.keywordScore(terms, chunk.text);
        const vector =
          queryEmbedding && chunk.embedding
            ? this.cosineSimilarity(queryEmbedding, chunk.embedding)
            : 0;
        const score = vector ? keyword + vector * 2 : keyword;
        return { chunk, score };
      })
      .sort((a, b) => b.score - a.score);

    return ranked.length
      ? ranked
      : chunks.slice(0, 5).map((chunk) => ({ chunk, score: 0 }));
  }

  private keywordScore(terms: string[], text: string): number {
    if (!terms.length) {
      return 0;
    }
    const haystack = ` ${text.toLowerCase()} `;
    return terms.reduce((score, term) => {
      const exactMatches = haystack.split(term).length - 1;
      const phraseBonus = haystack.includes(` ${term} `) ? 2 : 0;
      return score + exactMatches + phraseBonus;
    }, 0);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (!a.length || a.length !== b.length) {
      return 0;
    }
    let dot = 0;
    let aMagnitude = 0;
    let bMagnitude = 0;
    for (let index = 0; index < a.length; index += 1) {
      const av = a[index] ?? 0;
      const bv = b[index] ?? 0;
      dot += av * bv;
      aMagnitude += av ** 2;
      bMagnitude += bv ** 2;
    }
    if (!aMagnitude || !bMagnitude) {
      return 0;
    }
    return dot / (Math.sqrt(aMagnitude) * Math.sqrt(bMagnitude));
  }
}
