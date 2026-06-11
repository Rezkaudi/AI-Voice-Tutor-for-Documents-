import type { Citation } from "@/domain/entities/chat";
import type { DocumentPage } from "@/domain/entities/document";
import type { CitationCandidate } from "@/domain/logic/citation/citation-types";
import type { QuoteLocator } from "@/domain/logic/citation/quote-locator";
import type { AnswerAutoCiter } from "@/domain/logic/citation/answer-auto-citer";

export type { CitationCandidate } from "@/domain/logic/citation/citation-types";

/**
 * Turns the tutor's recorded citations (its CITATIONS trailer) into renderable
 * citations.
 *
 * The trailer gives us `{ page, quote }`; the PDF.js text layer needs
 * `{ start, end }` to wrap the matching glyphs. {@link resolve} delegates the
 * per-quote location to {@link QuoteLocator} and de-duplicates the results;
 * {@link autoCiteFromAnswer} falls back to {@link AnswerAutoCiter} when the
 * model recorded no citations at all.
 */
export class CitationResolver {
  /** Floor for Latin-script quotes — guards against trivially short matches. */
  private static readonly MIN_QUOTE_LENGTH = 3;
  /**
   * Floor for quotes containing CJK characters. CJK is far denser than Latin —
   * a page TITLE like "だけ" (2 chars) or "だろう" (3) is a real, locatable
   * citation, so the 3-char Latin floor would wrongly drop it.
   */
  private static readonly MIN_QUOTE_LENGTH_CJK = 2;
  /** Hiragana, katakana, CJK ideographs, and half-width kana. */
  private static readonly CJK = /[぀-ヿ㐀-鿿豈-﫿ｦ-ﾟ]/;

  constructor(
    private readonly locator: QuoteLocator,
    private readonly autoCiter: AnswerAutoCiter
  ) { }

  /** Maps verbatim quotes to `{ pageNumber, start, end }` spans on their page. */
  resolve(
    candidates: ReadonlyArray<CitationCandidate>,
    pages: ReadonlyArray<DocumentPage>
  ): Citation[] {
    const pageByNumber = new Map<number, DocumentPage>();
    for (const page of pages) {
      pageByNumber.set(page.pageNumber, page);
    }

    const resolved: Citation[] = [];
    const seen = new Set<string>();

    for (const candidate of candidates) {
      const page = pageByNumber.get(candidate.pageNumber);
      const quote = candidate.quote?.trim();
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

  /**
   * A quote clears the floor when it is long enough for its script: CJK quotes
   * pass at 2+ chars (so short page titles survive), Latin quotes at 6+.
   */
  private static longEnough(quote: string): boolean {
    const min = CitationResolver.CJK.test(quote)
      ? CitationResolver.MIN_QUOTE_LENGTH_CJK
      : CitationResolver.MIN_QUOTE_LENGTH;
    return quote.length >= min;
  }

  /** Synthesises citations from the answer when the model skipped `cite_passages`. */
  autoCiteFromAnswer(
    answer: string,
    page: DocumentPage,
    maxCitations: number = 2
  ): Citation[] {
    return this.autoCiter.cite(answer, page, maxCitations);
  }
}
