import { DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import type { DocumentPage, UploadKind } from "@/domain/entities/document";
import { UnprocessableEntityError } from "@/domain/errors/app-error";
import type { DocumentTextExtractor } from "@/domain/services/document-text-extractor";

/**
 * `DocumentTextExtractor` backed by pdf.js. PDFs are the only supported upload
 * format. Mirrors the original `extract-text` module.
 */
export class PdfJsTextExtractor implements DocumentTextExtractor {
  async extract(buffer: Buffer, _kind: UploadKind): Promise<DocumentPage[]> {
    return this.extractPdfPages(buffer);
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
        "We couldn't read any text in this PDF. Image-only or scanned files aren't supported — please upload a text-based PDF."
      );
    }
    return cleaned;
  }
}

/** A positioned text run from pdf.js (`transform` is `[a, b, c, d, x, y]`). */
interface PositionedItem {
  str: string;
  x: number;
  y: number;
  height: number;
}

/**
 * Builds the page text from pdf.js text items in true VISUAL reading order.
 *
 * pdf.js returns items in CONTENT-STREAM order, which is how the PDF was
 * authored, not how it reads on the page. Generator tools frequently emit a
 * boxed "Meaning / How To Use" table LAST in the stream even though it is drawn
 * near the top — so naively concatenating items dumps that box at the BOTTOM of
 * the extracted text. We instead reconstruct order from each item's position:
 * group runs into lines by their baseline `y` (top→bottom), then sort each line
 * left→right by `x`. This keeps tables, conjugation grids, and side-by-side
 * boxes in the order a reader actually sees them.
 *
 * Newlines are safe downstream: the citation matchers collapse all whitespace
 * (newlines included) to single spaces with an offset map, so highlighting is
 * unaffected, while the LLM now SEES the layout in the injected lesson material.
 */
function itemsToLayoutText(items: readonly unknown[]): string {
  const positioned: PositionedItem[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object" || !("str" in item)) continue;
    const run = item as { str: string; transform?: number[]; height?: number };
    if (!run.str) continue;
    const transform = run.transform;
    if (!Array.isArray(transform) || transform.length < 6) continue;
    positioned.push({
      str: run.str,
      x: transform[4]!,
      y: transform[5]!,
      height: run.height ?? Math.abs(transform[3] ?? 0)
    });
  }

  return normalizeLayoutText(positionedItemsToText(positioned));
}

/**
 * Orders positioned runs into top-to-bottom, left-to-right reading order.
 *
 * Runs whose baselines sit within a small vertical tolerance are treated as the
 * same visual line; the tolerance scales with glyph height so large headings and
 * small body text both group correctly. Lines are emitted top→bottom (PDF `y`
 * grows upward, so we sort descending) and each line's runs left→right.
 */
function positionedItemsToText(items: PositionedItem[]): string {
  if (items.length === 0) return "";

  const byTop = [...items].sort((a, b) => b.y - a.y);
  const lines: PositionedItem[][] = [];
  for (const item of byTop) {
    const current = lines[lines.length - 1];
    const reference = current?.[0];
    const tolerance = Math.max(2, (reference?.height ?? item.height) * 0.5);
    if (current && reference && Math.abs(reference.y - item.y) <= tolerance) {
      current.push(item);
    } else {
      lines.push([item]);
    }
  }

  return lines
    .map((line) =>
      line
        .sort((a, b) => a.x - b.x)
        .map((run) => run.str)
        .join(" ")
    )
    .join("\n");
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
