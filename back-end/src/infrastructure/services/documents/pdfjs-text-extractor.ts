import { DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import type { DocumentPage, UploadKind } from "@/domain/entities/document";
import { UnprocessableEntityError } from "@/domain/errors/app-error";
import type { DocumentTextExtractor } from "@/domain/services/document-text-extractor";

/** Characters per synthetic page when splitting a plain-text upload. */
const TEXT_PAGE_CHARS = 5000;
const MAX_PDF_PAGES = 300;

/**
 * `DocumentTextExtractor` backed by pdf.js (for PDFs) and a paragraph-aware
 * splitter (for text/markdown). Mirrors the original `extract-text` module.
 */
export class PdfJsTextExtractor implements DocumentTextExtractor {
  async extract(buffer: Buffer, kind: UploadKind): Promise<DocumentPage[]> {
    if (kind === "pdf") {
      return this.extractPdfPages(buffer);
    }
    return splitPlainText(buffer.toString("utf8"));
  }

  private async extractPdfPages(buffer: Buffer): Promise<DocumentPage[]> {
    installPdfJsNodePolyfills();

    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      disableFontFace: true,
      useSystemFonts: true
    });

    const pdf = await loadingTask.promise;
    if (pdf.numPages > MAX_PDF_PAGES) {
      throw new UnprocessableEntityError(
        `This PDF has ${pdf.numPages} pages. The MVP limit is ${MAX_PDF_PAGES} pages.`
      );
    }

    const pages: DocumentPage[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push({ pageNumber, text: itemsToLayoutText(content.items) });
    }

    const cleaned = stripRunningBoilerplate(pages);
    const searchablePages = cleaned.filter((page) => page.text.trim().length > 0);
    if (searchablePages.length === 0) {
      throw new UnprocessableEntityError(
        "This looks like a scanned PDF. The MVP supports text-based PDFs only."
      );
    }
    return cleaned;
  }
}

/**
 * Builds the page text from pdf.js text items while PRESERVING line structure.
 *
 * pdf.js tags each text run with `hasEOL` (it ends a visual line). The old code
 * joined every run with a single space, which flattened tables, conjugation
 * grids, and "How To Use" boxes into one unreadable run — the model then could
 * not tell a formation rule from prose and skipped it. We instead break a line
 * on `hasEOL`, so a table's rows survive as separate lines.
 *
 * Newlines are safe downstream: the citation matchers collapse all whitespace
 * (newlines included) to single spaces with an offset map, so highlighting is
 * unaffected, while the LLM now SEES the layout in the injected lesson material.
 */
function itemsToLayoutText(items: readonly unknown[]): string {
  let out = "";
  for (const item of items) {
    if (!item || typeof item !== "object" || !("str" in item)) continue;
    const run = item as { str: string; hasEOL?: boolean };
    out += run.str;
    out += run.hasEOL ? "\n" : " ";
  }
  return normalizeLayoutText(out);
}

/**
 * Collapses runs of intra-line spaces while keeping newlines, so layout (rows,
 * list items, headings on their own line) is retained but stray spacing is not.
 */
function normalizeLayoutText(text: string): string {
  return text
    .replace(/[^\S\n]+/g, " ") // collapse spaces/tabs but NOT newlines
    .replace(/ *\n */g, "\n") // drop spaces hugging a newline
    .replace(/\n{3,}/g, "\n\n") // cap blank-line runs at one
    .trim();
}

/**
 * Removes running footers/headers (e.g. "JLPTsensei.com 10") that repeat across
 * pages and would otherwise pollute citations — the worst case being a footer
 * that pdf.js glued onto a real content line, so a "How To Use" block citation
 * dragged "JLPTsensei.com 10" into the highlight.
 *
 * Detection works at the TRAILING/LEADING token level rather than whole lines,
 * because the footer is often fused onto the last content line ("…い-adjective
 * JLPTsensei.com 10") and so never appears standalone. We count the trailing
 * phrase of each page's last line (page number dropped) and the leading phrase
 * of its first line; a phrase recurring on a large share of pages is boilerplate
 * and is then stripped from page edges everywhere — even when glued to content.
 */
function stripRunningBoilerplate(pages: DocumentPage[]): DocumentPage[] {
  if (pages.length < 4) return pages; // too few pages to tell repetition apart

  const trailing = new Map<string, number>();
  const leading = new Map<string, number>();
  const bump = (map: Map<string, number>, phrase: string): void => {
    if (phrase.length >= 4 && phrase.length <= 60) {
      map.set(phrase, (map.get(phrase) ?? 0) + 1);
    }
  };

  for (const page of pages) {
    const lines = page.text.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    const lastTokens = withoutEdgeNumbers(lines[lines.length - 1]!.split(/\s+/));
    const firstTokens = withoutEdgeNumbers(lines[0]!.split(/\s+/));
    // candidate phrases: the last 1-3 tokens of the footer, first 1-3 of header
    for (let n = 1; n <= 3 && n <= lastTokens.length; n += 1) {
      bump(trailing, lastTokens.slice(lastTokens.length - n).join(" "));
    }
    for (let n = 1; n <= 3 && n <= firstTokens.length; n += 1) {
      bump(leading, firstTokens.slice(0, n).join(" "));
    }
  }

  const threshold = Math.max(3, Math.floor(pages.length * 0.3));
  const pick = (map: Map<string, number>): string[] =>
    [...map]
      .filter(([, count]) => count >= threshold)
      .map(([phrase]) => phrase)
      .sort((a, b) => b.length - a.length); // longest first → fullest match

  const trailingPhrases = pick(trailing);
  const leadingPhrases = pick(leading);
  if (trailingPhrases.length === 0 && leadingPhrases.length === 0) return pages;

  const footerPatterns = trailingPhrases.map(
    (phrase) => new RegExp("\\s*" + escapeRegExp(phrase) + "\\s*\\d*\\s*$")
  );
  const headerPatterns = leadingPhrases.map(
    (phrase) => new RegExp("^\\s*\\d*\\s*" + escapeRegExp(phrase) + "\\s*")
  );

  return pages.map((page) => {
    const kept = page.text
      .split("\n")
      .map((line) => {
        let stripped = line;
        for (const pattern of footerPatterns) stripped = stripped.replace(pattern, "");
        for (const pattern of headerPatterns) stripped = stripped.replace(pattern, "");
        return stripped;
      })
      .filter((line) => line.trim().length > 0);
    return { pageNumber: page.pageNumber, text: kept.join("\n") };
  });
}

/** Drops pure-number tokens from both ends (page numbers vary per page). */
function withoutEdgeNumbers(tokens: string[]): string[] {
  const copy = [...tokens];
  while (copy.length && /^\d+$/.test(copy[copy.length - 1]!)) copy.pop();
  while (copy.length && /^\d+$/.test(copy[0]!)) copy.shift();
  return copy;
}

/** Escapes a string for safe use inside a RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * pdf.js expects a handful of browser canvas globals. Install lightweight
 * native implementations once, before the library is loaded.
 */
function installPdfJsNodePolyfills(): void {
  const globals = globalThis as unknown as {
    DOMMatrix?: typeof DOMMatrix;
    ImageData?: typeof ImageData;
    Path2D?: typeof Path2D;
  };
  globals.DOMMatrix ??= DOMMatrix;
  globals.ImageData ??= ImageData;
  globals.Path2D ??= Path2D;
}

/** Splits plain text into fixed-size pages on paragraph/sentence boundaries. */
function splitPlainText(text: string): DocumentPage[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    throw new UnprocessableEntityError("The uploaded text file is empty.");
  }

  const pages: DocumentPage[] = [];
  let cursor = 0;
  while (cursor < normalized.length) {
    const roughEnd = Math.min(cursor + TEXT_PAGE_CHARS, normalized.length);
    const end =
      roughEnd === normalized.length
        ? roughEnd
        : findTextBoundary(normalized, cursor, roughEnd);
    const pageText = normalized.slice(cursor, end).trim();
    if (pageText) {
      pages.push({ pageNumber: pages.length + 1, text: pageText });
    }
    cursor = end;
  }
  return pages;
}

function findTextBoundary(text: string, start: number, roughEnd: number): number {
  const paragraphBreak = text.lastIndexOf("\n\n", roughEnd);
  if (paragraphBreak > start) {
    return paragraphBreak;
  }
  const sentenceBreak = text.lastIndexOf(". ", roughEnd);
  if (sentenceBreak > start) {
    return sentenceBreak + 1;
  }
  const wordBreak = text.lastIndexOf(" ", roughEnd);
  return wordBreak > start ? wordBreak : roughEnd;
}
