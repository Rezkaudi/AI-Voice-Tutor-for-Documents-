import type { DocumentChunk } from "@/domain/entities/document";

/**
 * Pure retrieval logic — keyword + vector ranking.
 *
 * No network, no framework: the tutor's `search_document` tool ranks chunks
 * through `rankChunks`, blending an embedding cosine score (when embeddings
 * are available) with a keyword score so retrieval still works before the
 * background embedding job has finished.
 */

export interface RankedChunk {
  chunk: DocumentChunk;
  score: number;
}

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "do", "does", "for", "from",
  "how", "i", "in", "is", "it", "of", "on", "or", "that", "the", "this", "to",
  "what", "when", "where", "which", "who", "why"
]);

/** Ranks chunks against a query, best match first. */
export function rankChunks(
  query: string,
  chunks: DocumentChunk[],
  queryEmbedding?: number[] | null
): RankedChunk[] {
  const terms = tokenize(query);
  const ranked = chunks
    .map((chunk) => {
      const keyword = keywordScore(terms, chunk.text);
      const vector =
        queryEmbedding && chunk.embedding
          ? cosineSimilarity(queryEmbedding, chunk.embedding)
          : 0;
      const score = vector ? keyword + vector * 2 : keyword;
      return { chunk, score };
    })
    .sort((a, b) => b.score - a.score);

  return ranked.length
    ? ranked
    : chunks.slice(0, 5).map((chunk) => ({ chunk, score: 0 }));
}

/** Lowercased, de-duplicated, de-noised content terms of a string. */
export function tokenize(value: string): string[] {
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .match(/[a-z0-9]+/g)
        ?.filter((term) => term.length > 1 && !STOP_WORDS.has(term)) ?? []
    )
  );
}

function keywordScore(terms: string[], text: string): number {
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

function cosineSimilarity(a: number[], b: number[]): number {
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
