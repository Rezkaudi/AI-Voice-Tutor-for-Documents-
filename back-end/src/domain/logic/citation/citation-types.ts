/**
 * Shared value types for the citation pipeline.
 *
 * A {@link CitationCandidate} is the raw `{ page, quote }` the tutor's
 * `cite_passages` tool emits; a {@link Span} is a half-open `[start, end)`
 * character range on a page, the shape the PDF.js text layer needs to wrap
 * matching glyphs.
 */
export interface CitationCandidate {
  pageNumber: number;
  quote: string;
}

export interface Span {
  start: number;
  end: number;
}

export interface SentenceSpan {
  text: string;
  start: number;
  end: number;
}
