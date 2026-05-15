import type { DocumentChunk } from "./types";

export type RankedChunk = {
  chunk: DocumentChunk;
  score: number;
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "do",
  "does",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why"
]);

export function rankChunks(
  query: string,
  chunks: DocumentChunk[],
  queryEmbedding?: number[] | null
): RankedChunk[] {
  const terms = tokenize(query);
  const ranked = chunks
    .map((chunk) => {
      const keyword = keywordScore(terms, chunk.text);
      const vector = queryEmbedding && chunk.embedding ? cosineSimilarity(queryEmbedding, chunk.embedding) : 0;
      const score = vector ? keyword + vector * 2 : keyword;

      return { chunk, score };
    })
    .sort((a, b) => b.score - a.score);

  return ranked.length ? ranked : chunks.slice(0, 5).map((chunk) => ({ chunk, score: 0 }));
}

export function buildReferenceSnippet(text: string, query: string, maxLength = 360): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const terms = tokenize(query);
  const lower = normalized.toLowerCase();
  const matchIndex = terms.reduce((best, term) => {
    const index = lower.indexOf(term);
    return index > -1 && (best === -1 || index < best) ? index : best;
  }, -1);

  if (matchIndex === -1) {
    return `${normalized.slice(0, maxLength - 3).trim()}...`;
  }

  const half = Math.floor(maxLength / 2);
  const start = Math.max(0, matchIndex - half);
  const end = Math.min(normalized.length, start + maxLength);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < normalized.length ? "..." : "";

  return `${prefix}${normalized.slice(start, end).trim()}${suffix}`;
}

export function tokenize(value: string): string[] {
  return Array.from(new Set(
    value
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((term) => term.length > 1 && !STOP_WORDS.has(term)) ?? []
  ));
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
    dot += a[index] * b[index];
    aMagnitude += a[index] ** 2;
    bMagnitude += b[index] ** 2;
  }

  if (!aMagnitude || !bMagnitude) {
    return 0;
  }

  return dot / (Math.sqrt(aMagnitude) * Math.sqrt(bMagnitude));
}
