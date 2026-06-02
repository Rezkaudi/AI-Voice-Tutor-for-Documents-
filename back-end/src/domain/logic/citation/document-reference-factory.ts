import type { Reference } from "@/domain/entities/chat";
import type { DocumentChunk, DocumentPage } from "@/domain/entities/document";

/**
 * Builds a {@link Reference} (page number + the page's first chunk id) for a
 * single page number, or `null` when the document has no such page.
 *
 * The UI jumps to `pageNumber` and the `chunkId` lets it scroll to the right
 * region; citations are attached later by {@link ReferenceSelector}.
 */
export class DocumentReferenceFactory {
  forPage(
    pageNumber: number,
    pages: ReadonlyArray<DocumentPage>,
    chunks: ReadonlyArray<DocumentChunk>
  ): Reference | null {
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
