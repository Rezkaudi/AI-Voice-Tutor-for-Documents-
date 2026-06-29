import type { Citation } from "@/domain/entities/chat";
import type { DocumentPage } from "@/domain/entities/document";
import type { CitationCandidate } from "@/domain/logic/citation/citation-types";
import type { QuoteLocator } from "@/domain/logic/citation/quote-locator";
import type { TextNormalizer } from "@/domain/logic/citation/text-normalizer";

export type { CitationCandidate } from "@/domain/logic/citation/citation-types";

export class CitationResolver {
  private static readonly MIN_QUOTE_LENGTH = 3;
  private static readonly MIN_QUOTE_LENGTH_CJK = 2;
  private static readonly CJK = /[぀-ヿ㐀-鿿豈-﫿ｦ-ﾟ]/;

  constructor(
    private readonly locator: QuoteLocator,
    private readonly textNormalizer: TextNormalizer
  ) { }

  resolve(candidates: ReadonlyArray<CitationCandidate>, pages: ReadonlyArray<DocumentPage>): Citation[] {

    const pageByNumber = new Map<number, DocumentPage>();
    for (const page of pages) {
      pageByNumber.set(page.pageNumber, page);
    }

    const resolved: Citation[] = [];
    const seen = new Set<string>();

    for (const candidate of candidates) {
      const page = pageByNumber.get(candidate.pageNumber);
      const quote = candidate.quote ? this.textNormalizer.canonicalize(candidate.quote).trim() : undefined;
      if (!page || !quote || !CitationResolver.longEnough(quote)) {
        continue;
      }
      const span = this.locator.locate(page.text, quote);
      if (!span) {
        continue;
      }
      const key = `${page.pageNumber}:${span.start}:${span.end}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      resolved.push({
        pageNumber: page.pageNumber,
        start: span.start,
        end: span.end,
        quote: page.text.slice(span.start, span.end)
      });
    }

    return resolved;
  }

  private static longEnough(quote: string): boolean {
    const min = CitationResolver.CJK.test(quote)
      ? CitationResolver.MIN_QUOTE_LENGTH_CJK
      : CitationResolver.MIN_QUOTE_LENGTH;
    return quote.length >= min;
  }
}
