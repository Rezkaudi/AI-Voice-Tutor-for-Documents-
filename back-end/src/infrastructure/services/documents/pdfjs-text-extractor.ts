import { DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import type { DocumentPage, UploadKind } from "@/domain/entities/document";
import { UnprocessableEntityError } from "@/domain/errors/app-error";
import type { DocumentTextExtractor } from "@/domain/services/document-text-extractor";
import { LayoutTextBuilder } from "@/domain/logic/pdf/layout-text-builder";
import type { PositionedTextItem } from "@/domain/logic/pdf/positioned-text-item";
import { HeaderFooterRemover } from "@/domain/logic/pdf/header-footer-remover";
import { ScriptDirection } from "@/domain/logic/pdf/script-direction";
import { canonicalizeGlyphs } from "@/shared/text";

export class PdfJsTextExtractor implements DocumentTextExtractor {
  constructor(
    private readonly layoutTextBuilder: LayoutTextBuilder,
    private readonly headerFooterRemover: HeaderFooterRemover
  ) { }

  static createDefault(): PdfJsTextExtractor {
    return new PdfJsTextExtractor(
      new LayoutTextBuilder(new ScriptDirection()),
      new HeaderFooterRemover()
    );
  }

  async extract(buffer: Buffer, _kind: UploadKind): Promise<DocumentPage[]> {
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
      const items = this.toPositionedItems(content.items);
      pages.push({ pageNumber, text: this.layoutTextBuilder.build(items) });
    }

    const cleaned = this.headerFooterRemover.remove(pages);
    const hasText = cleaned.some((page) => page.text.trim().length > 0);
    if (!hasText) {
      throw new UnprocessableEntityError(
        "We couldn't read any text in this PDF. Image-only or scanned files aren't supported — please upload a text-based PDF."
      );
    }
    return cleaned;
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
        str: canonicalizeGlyphs(run.str),
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
