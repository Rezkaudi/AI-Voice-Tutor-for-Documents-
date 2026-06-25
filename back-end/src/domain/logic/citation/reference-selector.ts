import type { Reference } from "@/domain/entities/chat";
import type { DocumentChunk, DocumentPage } from "@/domain/entities/document";
import type { CitationCandidate } from "@/domain/logic/citation/citation-types";
import type { CitationResolver } from "@/domain/logic/citation-resolver";
import type { DocumentReferenceFactory } from "@/domain/logic/citation/document-reference-factory";

export interface ReferenceSelection {
  answer: string;
  referencesByPage: Map<number, Reference>;
  fallback: Reference | null;
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
    const { answer, referencesByPage, fallback, pages, chunks, citedCandidates } = input;
    const resolved = this.citations.resolve(citedCandidates, pages);

    if (resolved.length > 0) {
      const primaryPage = resolved[0]!.pageNumber;
      const base =
        referencesByPage.get(primaryPage) ??
        this.referenceFactory.forPage(primaryPage, pages, chunks) ??
        { pageNumber: primaryPage, citations: [] };
      return { ...base, citations: resolved };
    }

    let chosen: Reference | null = null;
    for (const match of answer.matchAll(/\bpages?\s+(\d+)\b/gi)) {
      const pageNumber = Number(match[1]);
      chosen =
        referencesByPage.get(pageNumber) ??
        this.referenceFactory.forPage(pageNumber, pages, chunks);
      if (chosen) break;
    }
    chosen ??= fallback;
    if (!chosen) {
      return null;
    }

    const page = pages.find((item) => item.pageNumber === chosen!.pageNumber);
    if (page) {
      const auto = this.citations.autoCiteFromAnswer(answer, page);
      if (auto.length > 0) {
        return { ...chosen, citations: auto };
      }
    }
    return chosen;
  }
}
