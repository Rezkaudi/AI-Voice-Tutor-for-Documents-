import { DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import type { DocumentPage, UploadKind } from "@/domain/entities/document";
import { UnprocessableEntityError } from "@/domain/errors/app-error";
import type { DocumentTextExtractor } from "@/domain/services/document-text-extractor";
import { normalizeText } from "@/shared/text";

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
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
      pages.push({ pageNumber, text: normalizeText(text) });
    }

    const searchablePages = pages.filter((page) => page.text.trim().length > 0);
    if (searchablePages.length === 0) {
      throw new UnprocessableEntityError(
        "This looks like a scanned PDF. The MVP supports text-based PDFs only."
      );
    }
    return pages;
  }
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
