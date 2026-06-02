import type { Reference } from "@/domain/entities/chat";
import type { DocumentChunk, DocumentPage } from "@/domain/entities/document";
import type { CitationCandidate } from "@/domain/logic/citation/citation-types";
import type { CitationResolver } from "@/domain/logic/citation-resolver";
import type { DocumentReferenceFactory } from "@/domain/logic/citation/document-reference-factory";

/** Inputs needed to choose which page reference the answer should jump to. */
export interface ReferenceSelection {
  answer: string;
  referencesByPage: Map<number, Reference>;
  fallback: Reference | null;
  pages: ReadonlyArray<DocumentPage>;
  chunks: ReadonlyArray<DocumentChunk>;
  citedCandidates: ReadonlyArray<CitationCandidate>;
}

/**
 * Chooses the reference to show alongside an answer.
 *
 * Preference order: the page(s) of verbatim quotes the model recorded via
 * `cite_passages`, then the first page the answer names ("on page 4, …"),
 * falling back to the last tool's top hit. When no verbatim citations exist it
 * synthesises them from the chosen page so the UI still highlights support.
 */
export class ReferenceSelector {
  constructor(
    private readonly citations: CitationResolver,
    private readonly referenceFactory: DocumentReferenceFactory
  ) {}

  select(input: ReferenceSelection): Reference | null {
    const { answer, referencesByPage, fallback, pages, chunks, citedCandidates } = input;
    const resolved = this.citations.resolve(citedCandidates, pages);

    // Verbatim citations beat regex — anchor to the first one's page and attach
    // every resolved span.
    if (resolved.length > 0) {
      const primaryPage = resolved[0]!.pageNumber;
      const base =
        referencesByPage.get(primaryPage) ??
        this.referenceFactory.forPage(primaryPage, pages, chunks) ??
        { pageNumber: primaryPage, citations: [] };
      return { ...base, citations: resolved };
    }

    // The save-cost model often skips `cite_passages`: pick a page from the
    // answer's regex (or the last tool's top hit) and synthesise citations.
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
