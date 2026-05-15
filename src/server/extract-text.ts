import { MAX_PDF_PAGES, normalizeText } from "@/lib/documents";
import type { DocumentPage, UploadKind } from "@/lib/types";

const TEXT_PAGE_CHARS = 5000;

export async function extractPagesFromUpload(buffer: Buffer, kind: UploadKind): Promise<DocumentPage[]> {
  if (kind === "pdf") {
    return extractPdfPages(buffer);
  }

  return splitPlainText(buffer.toString("utf8"));
}

async function extractPdfPages(buffer: Buffer): Promise<DocumentPage[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableFontFace: true,
    useSystemFonts: true
  });

  const pdf = await loadingTask.promise;
  if (pdf.numPages > MAX_PDF_PAGES) {
    throw new Error(`This PDF has ${pdf.numPages} pages. The MVP limit is ${MAX_PDF_PAGES} pages.`);
  }

  const pages: DocumentPage[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");

    pages.push({
      pageNumber,
      text: normalizeText(text)
    });
  }

  const searchablePages = pages.filter((page) => page.text.trim().length > 0);
  if (!searchablePages.length) {
    throw new Error("This looks like a scanned PDF. The MVP supports text-based PDFs only.");
  }

  return pages;
}

function splitPlainText(text: string): DocumentPage[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    throw new Error("The uploaded text file is empty.");
  }

  const pages: DocumentPage[] = [];
  let cursor = 0;

  while (cursor < normalized.length) {
    const roughEnd = Math.min(cursor + TEXT_PAGE_CHARS, normalized.length);
    const end = roughEnd === normalized.length ? roughEnd : findTextBoundary(normalized, cursor, roughEnd);
    const pageText = normalized.slice(cursor, end).trim();

    if (pageText) {
      pages.push({
        pageNumber: pages.length + 1,
        text: pageText
      });
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
