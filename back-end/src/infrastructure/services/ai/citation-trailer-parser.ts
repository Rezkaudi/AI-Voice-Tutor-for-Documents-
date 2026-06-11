import type { CitationCandidate } from "@/domain/logic/citation-resolver";

/** The spoken reply with its trailer removed, plus the citations it declared. */
export interface ParsedReply {
  spokenText: string;
  candidates: CitationCandidate[];
}

/**
 * Parses the CITATIONS trailer the tutor is instructed to append to each reply:
 *
 *     CITATIONS:
 *     [[1]] page=15 "exact quote from that page"
 *     [[2]] page=16 "another exact quote"
 *
 * This replaces the `cite_passages` tool call — same `{ page, quote }` payload,
 * but carried in the answer itself so the turn costs a single model round-trip.
 * The block is stripped from the spoken text; its lines become citation
 * candidates ordered by their `[[N]]` label, so candidate `K-1` grounds marker
 * `[[K]]` exactly as the tool's array order used to. Malformed lines are
 * dropped; a reply without a trailer yields no candidates.
 */
export class CitationTrailerParser {
  private static readonly HEADER = /^[ \t]*CITATIONS:?[ \t]*$/gim;
  private static readonly LINE = /^\s*\[\[(\d+)\]\]\s*page\s*[=:]?\s*(\d+)\s*(.+?)\s*$/;
  /** Straight/curly double quotes the model may wrap the quote in. */
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

  /** The last `CITATIONS:` line, so a spoken mention earlier can't truncate the reply. */
  private lastHeaderMatch(text: string): { start: number; end: number } | null {
    CitationTrailerParser.HEADER.lastIndex = 0;
    let last: { start: number; end: number } | null = null;
    for (const match of text.matchAll(CitationTrailerParser.HEADER)) {
      last = { start: match.index, end: match.index + match[0].length };
    }
    return last;
  }
}
