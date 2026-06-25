import type { Reference } from "@/domain/entities/chat";
import type { DocumentChunk, DocumentPage } from "@/domain/entities/document";

export class DocumentReferenceFactory {
  forPage(pageNumber: number, pages: ReadonlyArray<DocumentPage>, chunks: ReadonlyArray<DocumentChunk>): Reference | null {
    const page = pages.find((item) => item.pageNumber === pageNumber);

    if (!page) {
      return null;
    }
    const reference: Reference = { pageNumber: page.pageNumber, citations: [] };
    const chunkId = chunks.find((chunk) => chunk.pageNumber === page.pageNumber)?.id;
    if (chunkId) {
      reference.chunkId = chunkId;
    }
    return reference;
  }
}
