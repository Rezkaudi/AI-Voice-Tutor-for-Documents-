import type { DocumentChunk, DocumentPage } from "@/domain/entities/document";
import type { IdGenerator } from "@/domain/services/id-generator";
import { normalizeText } from "@/shared/text";

export interface ChunkOptions {
  maxChars?: number;
  overlapChars?: number;
}

/**
 * Splits extracted pages into overlapping, embeddable chunks.
 *
 * Pure: text is handed in, chunks come out — no I/O. The overlap keeps a
 * sentence that straddles a chunk boundary retrievable from either side.
 */
export class DocumentChunker {
  private static readonly DEFAULT_MAX_CHARS = 1600;
  private static readonly DEFAULT_OVERLAP_CHARS = 220;

  constructor(private readonly idGenerator: IdGenerator) {}

  /** Splits pages into overlapping chunks, in reading order. */
  chunk(
    pages: Array<
      Pick<DocumentPage, "pageNumber" | "text"> &
        Partial<Pick<DocumentPage, "documentId">>
    >,
    options: ChunkOptions = {}
  ): DocumentChunk[] {
    const maxChars = options.maxChars ?? DocumentChunker.DEFAULT_MAX_CHARS;
    const overlapChars = Math.min(
      options.overlapChars ?? DocumentChunker.DEFAULT_OVERLAP_CHARS,
      Math.floor(maxChars / 2)
    );
    const chunks: DocumentChunk[] = [];

    for (const page of pages) {
      const normalized = normalizeText(page.text);
      if (!normalized) {
        continue;
      }
      for (const segment of this.splitTextWithOverlap(
        normalized,
        maxChars,
        overlapChars
      )) {
        chunks.push({
          id: this.idGenerator.uuid(),
          documentId: page.documentId ?? "",
          pageNumber: page.pageNumber,
          chunkIndex: chunks.length,
          text: segment
        });
      }
    }
    return chunks;
  }

  private splitTextWithOverlap(
    text: string,
    maxChars: number,
    overlapChars: number
  ): string[] {
    if (text.length <= maxChars) {
      return [text];
    }
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      const roughEnd = Math.min(start + maxChars, text.length);
      const end =
        roughEnd === text.length
          ? roughEnd
          : this.findSoftBoundary(text, start, roughEnd);
      const chunk = text.slice(start, end).trim();
      if (chunk) {
        chunks.push(chunk);
      }
      if (end >= text.length) {
        break;
      }
      start = Math.max(end - overlapChars, start + 1);
    }
    return chunks;
  }

  private findSoftBoundary(text: string, start: number, roughEnd: number): number {
    const windowStart = Math.max(start + 1, roughEnd - 160);
    const slice = text.slice(windowStart, roughEnd);
    const sentenceBreak = Math.max(
      slice.lastIndexOf(". "),
      slice.lastIndexOf("? "),
      slice.lastIndexOf("! ")
    );
    if (sentenceBreak > -1) {
      return windowStart + sentenceBreak + 1;
    }
    const wordBreak = text.lastIndexOf(" ", roughEnd);
    return wordBreak > start ? wordBreak : roughEnd;
  }
}
