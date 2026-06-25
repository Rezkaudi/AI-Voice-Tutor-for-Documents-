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
