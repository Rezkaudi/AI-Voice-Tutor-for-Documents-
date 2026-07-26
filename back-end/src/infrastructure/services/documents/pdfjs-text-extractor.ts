import { DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import type { DocumentPage } from "@/domain/entities/document";
import type { DocumentTextExtractor } from "@/domain/services/document-text-extractor";
import { fetchPdfBytes } from "@/infrastructure/services/documents/fetch-pdf-bytes";
import { LayoutTextBuilder } from "@/domain/logic/pdf/layout-text-builder";
import type { PositionedTextItem } from "@/domain/logic/pdf/positioned-text-item";
import { HeaderFooterRemover } from "@/domain/logic/pdf/header-footer-remover";
import { ScriptDirection } from "@/domain/logic/pdf/script-direction";
import { TextNormalizer } from "@/domain/logic/citation/text-normalizer";

interface PdfPage {
  getTextContent(): Promise<{ items: readonly unknown[] }>;
}

interface PdfDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPage>;
}

export class PdfJsTextExtractor implements DocumentTextExtractor {
  constructor(
    private readonly layoutTextBuilder: LayoutTextBuilder,
    private readonly headerFooterRemover: HeaderFooterRemover,
    private readonly textNormalizer: TextNormalizer
  ) { }

  static createDefault(): PdfJsTextExtractor {
    return new PdfJsTextExtractor(
      new LayoutTextBuilder(new ScriptDirection()),
      new HeaderFooterRemover(),
      new TextNormalizer()
    );
  }

  async extractPages(pdfUrl: string, pageNumbers: number[]): Promise<DocumentPage[]> {
    const pdf = await this.load(await fetchPdfBytes(pdfUrl));

    const wanted = Array.from(new Set(pageNumbers))
      .filter((pageNumber) => pageNumber >= 1 && pageNumber <= pdf.numPages)
      .sort((a, b) => a - b);

    const pages: DocumentPage[] = [];
    for (const pageNumber of wanted) {
      pages.push(await this.readPage(pdf, pageNumber));
    }
    return pages;
  }

  private async load(buffer: Buffer): Promise<PdfDocument> {
    installPdfJsNodePolyfills();

    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      disableFontFace: true,
      useSystemFonts: true
    });
    return loadingTask.promise as unknown as PdfDocument;
  }

  private async readPage(pdf: PdfDocument, pageNumber: number): Promise<DocumentPage> {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = this.toPositionedItems(content.items);
    return { pageNumber, text: this.layoutTextBuilder.build(items) };
  }

  private toPositionedItems(items: readonly unknown[]): PositionedTextItem[] {
    const positioned: PositionedTextItem[] = [];
    for (const item of items) {
      if (!item || typeof item !== "object" || !("str" in item)) continue;
      const run = item as { str: string; transform?: number[]; height?: number };
      if (!run.str) continue;
      const transform = run.transform;
      if (!Array.isArray(transform) || transform.length < 6) continue;
      positioned.push({
        str: this.textNormalizer.canonicalize(run.str),
        x: transform[4]!,
        y: transform[5]!,
        height: run.height ?? Math.abs(transform[3] ?? 0)
      });
    }
    return positioned;
  }
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
