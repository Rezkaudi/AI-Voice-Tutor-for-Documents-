import type { DocumentCitation } from "@/types";

/**
 * Re-locates a citation's quote inside the page text built from the PDF.js
 * text layer. Backend `start/end` offsets are computed on the backend's own
 * OCR page text, whose character order can diverge from the front-end text
 * map (especially on multi-column pages), so highlights anchored on the quote
 * itself are more reliable. Falls back to the backend offsets when the quote
 * cannot be found.
 */
export function relocateCitation(
  pageText: string,
  citation: DocumentCitation
): DocumentCitation {
  const span = locateQuote(pageText, citation.quote);
  return span ? { ...citation, ...span } : citation;
}

interface Span {
  start: number;
  end: number;
}

function locateQuote(pageText: string, quote: string): Span | null {
  if (!quote) return null;
  const direct = pageText.indexOf(quote);
  if (direct !== -1) {
    return { start: direct, end: direct + quote.length };
  }
  return (
    matchCollapsed(pageText, quote.replace(/\s+/g, " ").trim()) ??
    matchLoose(pageText, quote)
  );
}

/** Whitespace-insensitive, then case-insensitive match (mirrors backend QuoteLocator). */
function matchCollapsed(pageText: string, target: string): Span | null {
  if (!target) return null;
  const { normalized, offsets } = collapseWithOffsets(pageText);
  let index = normalized.indexOf(target);
  if (index === -1) {
    index = normalized.toLowerCase().indexOf(target.toLowerCase());
  }
  if (index === -1) return null;
  return mapToSpan(offsets, index, target.length, pageText.length);
}

/** Letters/digits-only match, tolerant of punctuation differences. */
function matchLoose(pageText: string, quote: string): Span | null {
  const { normalized: looseQuote } = looseWithOffsets(quote);
  if (!looseQuote) return null;
  const { normalized: loosePage, offsets } = looseWithOffsets(pageText);
  const index = loosePage.indexOf(looseQuote);
  if (index === -1) return null;
  return mapToSpan(offsets, index, looseQuote.length, pageText.length);
}

function collapseWithOffsets(text: string): { normalized: string; offsets: number[] } {
  let normalized = "";
  const offsets: number[] = [];
  let inWhitespace = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (/\s/.test(char)) {
      if (!inWhitespace && normalized.length > 0) {
        normalized += " ";
        offsets.push(i);
      }
      inWhitespace = true;
    } else {
      normalized += char;
      offsets.push(i);
      inWhitespace = false;
    }
  }
  return trimTrailingSpace(normalized, offsets);
}

function looseWithOffsets(text: string): { normalized: string; offsets: number[] } {
  let normalized = "";
  const offsets: number[] = [];
  let inGap = true;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (/[\p{L}\p{N}]/u.test(char)) {
      normalized += char.toLowerCase();
      offsets.push(i);
      inGap = false;
    } else if (!inGap) {
      normalized += " ";
      offsets.push(i);
      inGap = true;
    }
  }
  return trimTrailingSpace(normalized, offsets);
}

function mapToSpan(
  offsets: number[],
  normalizedStart: number,
  normalizedLength: number,
  pageLength: number
): Span | null {
  const start = offsets[normalizedStart];
  const endIndex = normalizedStart + normalizedLength - 1;
  if (start === undefined || endIndex >= offsets.length) return null;
  const lastChar = offsets[endIndex];
  if (lastChar === undefined) return null;
  return { start, end: Math.min(pageLength, lastChar + 1) };
}

function trimTrailingSpace(
  normalized: string,
  offsets: number[]
): { normalized: string; offsets: number[] } {
  if (normalized.endsWith(" ")) {
    return { normalized: normalized.slice(0, -1), offsets: offsets.slice(0, -1) };
  }
  return { normalized, offsets };
}
