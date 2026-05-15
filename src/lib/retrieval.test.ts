import { describe, expect, it } from "vitest";
import { buildReferenceSnippet, rankChunks } from "./retrieval";
import type { DocumentChunk } from "./types";

const chunks: DocumentChunk[] = [
  {
    id: "a",
    documentId: "doc",
    pageNumber: 1,
    chunkIndex: 0,
    text: "The introduction explains classroom expectations and grading policies.",
    snippet: "The introduction explains classroom expectations."
  },
  {
    id: "b",
    documentId: "doc",
    pageNumber: 5,
    chunkIndex: 1,
    text: "Mitochondria produce ATP through cellular respiration and are often discussed in biology lessons.",
    snippet: "Mitochondria produce ATP."
  }
];

describe("rankChunks", () => {
  it("prioritizes chunks that contain the user's key terms", () => {
    const ranked = rankChunks("How do mitochondria produce ATP?", chunks);

    expect(ranked[0].chunk.id).toBe("b");
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });
});

describe("buildReferenceSnippet", () => {
  it("returns a short excerpt around the matching term", () => {
    const snippet = buildReferenceSnippet(chunks[1].text, "ATP");

    expect(snippet).toContain("ATP");
    expect(snippet.length).toBeLessThanOrEqual(360);
  });
});
