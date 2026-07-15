import type { Reference } from "@/domain/entities/chat";
import type { DocumentPage } from "@/domain/entities/document";

export class DocumentReferenceFactory {
  forPage(pageNumber: number, pages: ReadonlyArray<DocumentPage>): Reference | null {
    const page = pages.find((item) => item.pageNumber === pageNumber);

    if (!page) {
      return null;
    }
    return { pageNumber: page.pageNumber, citations: [] };
  }
}
