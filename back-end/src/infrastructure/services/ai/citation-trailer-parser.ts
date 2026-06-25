import type { CitationCandidate } from "@/domain/logic/citation-resolver";

export interface ParsedReply {
  spokenText: string;
  candidates: CitationCandidate[];
}

export class CitationTrailerParser {
  private static readonly HEADER = /^[ \t]*CITATIONS:?[ \t]*$/gim;
  private static readonly LINE = /^\s*\[\[(\d+)\]\]\s*page\s*[=:]?\s*(\d+)\s*(.+?)\s*$/;
  private static readonly WRAPPING_QUOTES = /^["“”]+|["“”]+$/g;

  parse(text: string): ParsedReply {
    const header = this.lastHeaderMatch(text);
    if (!header) {
      return { spokenText: text, candidates: [] };
    }

    const byLabel = new Map<number, CitationCandidate>();
    for (const line of text.slice(header.end).split("\n")) {
      const match = CitationTrailerParser.LINE.exec(line);
      if (!match) {
        continue;
      }
      const label = Number(match[1]);
      const pageNumber = Number(match[2]);
      const quote = match[3]!
        .replace(CitationTrailerParser.WRAPPING_QUOTES, "")
        .trim();
      if (pageNumber < 1 || !quote || byLabel.has(label)) {
        continue;
      }
      byLabel.set(label, { pageNumber, quote });
    }

    return {
      spokenText: text.slice(0, header.start).trimEnd(),
      candidates: [...byLabel.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, candidate]) => candidate)
    };
  }

  private lastHeaderMatch(text: string): { start: number; end: number } | null {
    CitationTrailerParser.HEADER.lastIndex = 0;
    let last: { start: number; end: number } | null = null;
    for (const match of text.matchAll(CitationTrailerParser.HEADER)) {
      last = { start: match.index, end: match.index + match[0].length };
    }
    return last;
  }
}
