import type { Reference } from "@/domain/entities/chat";
import type { DocumentChunk, DocumentPage } from "@/domain/entities/document";
import type { CitationCandidate } from "@/domain/logic/citation/citation-types";
import type { CitationResolver } from "@/domain/logic/citation/citation-resolver";
import type { DocumentReferenceFactory } from "@/domain/logic/citation/document-reference-factory";

export interface ReferenceSelection {
  referencesByPage: Map<number, Reference>;
  pages: ReadonlyArray<DocumentPage>;
  chunks: ReadonlyArray<DocumentChunk>;
  citedCandidates: ReadonlyArray<CitationCandidate>;
}

export class ReferenceSelector {
  constructor(
    private readonly citations: CitationResolver,
    private readonly referenceFactory: DocumentReferenceFactory
  ) { }

  select(input: ReferenceSelection): Reference | null {
    const { referencesByPage, pages, chunks, citedCandidates } = input;

    const resolved = this.citations.resolve(citedCandidates, pages);
    if (resolved.length === 0) {
      return null;
    }

    const primaryPage = resolved[0]!.pageNumber;
    const base =
      referencesByPage.get(primaryPage) ??
      this.referenceFactory.forPage(primaryPage, pages, chunks) ??
      { pageNumber: primaryPage, citations: [] };
    return { ...base, citations: resolved };
  }
}
