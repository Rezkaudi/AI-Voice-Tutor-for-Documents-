import { DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import type { DocumentPage, UploadKind } from "@/domain/entities/document";
import { UnprocessableEntityError } from "@/domain/errors/app-error";
import type { DocumentTextExtractor } from "@/domain/services/document-text-extractor";
import { canonicalizeGlyphs } from "@/shared/text";

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

interface PositionedItem {
  str: string;
  x: number;
  y: number;
  height: number;
}

function itemsToLayoutText(items: readonly unknown[]): string {
  const positioned: PositionedItem[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object" || !("str" in item)) continue;
    const run = item as { str: string; transform?: number[]; height?: number };
    if (!run.str) continue;
    const transform = run.transform;
    if (!Array.isArray(transform) || transform.length < 6) continue;
    positioned.push({
      str: canonicalizeGlyphs(run.str),
      x: transform[4]!,
      y: transform[5]!,
      height: run.height ?? Math.abs(transform[3] ?? 0)
    });
  }

  return normalizeLayoutText(positionedItemsToText(positioned));
}

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
    .map((line) => orderLineRuns(line).map((run) => run.str).join(" "))
    .join("\n");
}

function orderLineRuns(line: PositionedItem[]): PositionedItem[] {
  const text = line.map((run) => run.str).join("");
  return isRightToLeft(text)
    ? [...line].sort((a, b) => b.x - a.x)
    : [...line].sort((a, b) => a.x - b.x);
}

/** Strong RTL characters: Arabic and Hebrew, base and presentation blocks. */
const RTL_CHARS = /[\u0590-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/g;
/** Strong LTR letters: Latin, Greek, Cyrillic, and CJK (all read left→right). */
const LTR_CHARS = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u3040-\u30FF\u3400-\u9FFF]/g;

function isRightToLeft(text: string): boolean {
  const rtl = text.match(RTL_CHARS)?.length ?? 0;
  const ltr = text.match(LTR_CHARS)?.length ?? 0;
  return rtl > ltr;
}

function normalizeLayoutText(text: string): string {
  return text
    .replace(/[^\S\n]+/g, " ") // collapse spaces/tabs but NOT newlines
    .replace(/ *\n */g, "\n") // drop spaces hugging a newline
    .replace(/\n{3,}/g, "\n\n") // cap blank-line runs at one
    .trim();
}

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
      .sort((a, b) => b.length - a.length);

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

function withoutEdgeNumbers(tokens: string[]): string[] {
  const copy = [...tokens];
  while (copy.length && /^\d+$/.test(copy[copy.length - 1]!)) copy.pop();
  while (copy.length && /^\d+$/.test(copy[0]!)) copy.shift();
  return copy;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
