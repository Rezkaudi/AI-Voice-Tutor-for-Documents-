import type { PaddleOcrService, PaddleOcrResult } from "ppu-paddle-ocr";

import type { DocumentPage, UploadKind } from "@/domain/entities/document";
import type { DocumentTextExtractor } from "@/domain/services/document-text-extractor";
import type { Logger } from "@/domain/services/logger";
import { TextNormalizer } from "@/domain/logic/citation/text-normalizer";
import { ReadingOrderBuilder } from "@/domain/logic/pdf/reading-order-builder";
import type { LayoutRegion, PositionedOcrItem } from "@/domain/logic/pdf/layout-region";
import { DocLayoutRegionDetector } from "@/infrastructure/services/documents/doclayout-region-detector";
import { PdfiumPageRenderer } from "@/infrastructure/services/documents/pdfium-page-renderer";

export class PaddleOcrTextExtractor implements DocumentTextExtractor {
  private static readonly MIN_CONFIDENCE = 0.5;
  private static readonly MAX_SIDE_LENGTH = 1536;

  private servicePromise: Promise<PaddleOcrService> | null = null;

  constructor(
    private readonly renderer: PdfiumPageRenderer,
    private readonly layoutDetector: DocLayoutRegionDetector,
    private readonly readingOrder: ReadingOrderBuilder,
    private readonly textNormalizer: TextNormalizer,
    private readonly logger: Logger
  ) { }

  async extract(buffer: Buffer, _kind: UploadKind): Promise<DocumentPage[]> {
    const total = await this.renderer.countPages(buffer);
    const pageNumbers = Array.from({ length: total }, (_, index) => index + 1);
    return this.extractPages(buffer, pageNumbers);
  }

  async countPages(buffer: Buffer): Promise<number> {
    return this.renderer.countPages(buffer);
  }

  async extractPages(buffer: Buffer, pageNumbers: number[]): Promise<DocumentPage[]> {
    const rendered = await this.renderer.renderPages(buffer, pageNumbers);
    if (rendered.length === 0) return [];

    const log = this.logger.scope("paddle-ocr");
    const layoutsPromise = this.detectLayouts(rendered, log);
    const service = await this.service();

    const started = Date.now();
    const results = await service.batchRecognize(
      rendered.map((page) => page.png),
      { settle: true }
    );
    log.info(`recognized ${rendered.length} page(s) in ${Date.now() - started}ms`);
    const layouts = await layoutsPromise;

    return results.map((item, index) => {
      const pageNumber = rendered[index]!.pageNumber;
      if (item.status === "rejected") {
        log.error(`page ${pageNumber} failed`, item.reason);
        return { pageNumber, text: "" };
      }
      return {
        pageNumber,
        text: this.toPageText(item.value as PaddleOcrResult, layouts.get(pageNumber) ?? [])
      };
    });
  }

  private async detectLayouts(
    rendered: Awaited<ReturnType<PdfiumPageRenderer["renderPages"]>>,
    log: Logger
  ): Promise<Map<number, LayoutRegion[]>> {
    const started = Date.now();
    const layouts = new Map<number, LayoutRegion[]>();
    for (const page of rendered) {
      layouts.set(page.pageNumber, await this.layoutDetector.detectRegions(page.png));
    }
    log.info(`analyzed layout of ${rendered.length} page(s) in ${Date.now() - started}ms`);
    return layouts;
  }

  private toPageText(result: PaddleOcrResult, regions: LayoutRegion[]): string {
    const lines: string[] = [];
    for (const line of this.orderLines(result.lines, regions)) {
      const texts = line
        .map((item) => this.cleanOcrText(item.text))
        .filter((text) => text.length > 0);
      if (texts.length > 0) lines.push(texts.join(" "));
    }
    return lines.join("\n");
  }

  private cleanOcrText(value: string): string {
    return this.textNormalizer
      .canonicalize(value)
      .replace(/\b((?:PAIR|GROUP) WORK)(?=\p{Lu})/gu, "$1 ")
      .replace(/\s*(?:\.\s*){3}/g, " . . .")
      .replace(/((?:\. ?){2,})[I|l]$/u, "$1")
      .trim();
  }

  /** Region-ordered lines when layout analysis succeeded; the OCR library's line order otherwise. */
  private orderLines(
    lines: PaddleOcrResult["lines"],
    regions: LayoutRegion[]
  ): PositionedOcrItem[][] {
    const project = (items: PaddleOcrResult["lines"][number]): PositionedOcrItem[] =>
      items
        .filter((item) => item.confidence >= PaddleOcrTextExtractor.MIN_CONFIDENCE)
        .map((item) => ({
          text: item.text,
          confidence: item.confidence,
          x: item.box.x,
          y: item.box.y,
          width: item.box.width,
          height: item.box.height
        }));

    const kept = project(lines.flat());
    const ordered = this.readingOrder.order(kept, regions);
    if (ordered) return ordered;
    return lines.map(project).filter((line) => line.length > 0);
  }

  private service(): Promise<PaddleOcrService> {
    if (!this.servicePromise) {
      this.servicePromise = (async () => {
        const log = this.logger.scope("paddle-ocr");
        log.info("loading PP-OCRv6 models (downloaded and cached on first run)");
        const { PaddleOcrService: Service } = await import("ppu-paddle-ocr");
        const service = new Service({
          detection: { maxSideLength: PaddleOcrTextExtractor.MAX_SIDE_LENGTH },
          debugging: { debug: false, verbose: false }
        });
        await service.initialize();
        log.info("models ready");
        return service;
      })().catch((error) => {
        // Allow a retry on the next request instead of caching the failure.
        this.servicePromise = null;
        throw error;
      });
    }
    return this.servicePromise;
  }
}
