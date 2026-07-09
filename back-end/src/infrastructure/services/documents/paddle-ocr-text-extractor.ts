import type { PaddleOcrService, PaddleOcrResult } from "ppu-paddle-ocr";

import type { DocumentPage, UploadKind } from "@/domain/entities/document";
import type { DocumentTextExtractor } from "@/domain/services/document-text-extractor";
import type { Logger } from "@/domain/services/logger";
import { TextNormalizer } from "@/domain/logic/citation/text-normalizer";
import { PdfiumPageRenderer } from "@/infrastructure/services/documents/pdfium-page-renderer";

export class PaddleOcrTextExtractor implements DocumentTextExtractor {
  private static readonly MIN_CONFIDENCE = 0.5;
  private static readonly MAX_SIDE_LENGTH = 1536;

  private servicePromise: Promise<PaddleOcrService> | null = null;

  constructor(
    private readonly renderer: PdfiumPageRenderer,
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
    const service = await this.service();

    const started = Date.now();
    const results = await service.batchRecognize(
      rendered.map((page) => page.png),
      { settle: true }
    );
    log.info(`recognized ${rendered.length} page(s) in ${Date.now() - started}ms`);

    return results.map((item, index) => {
      const pageNumber = rendered[index]!.pageNumber;
      if (item.status === "rejected") {
        log.error(`page ${pageNumber} failed`, item.reason);
        return { pageNumber, text: "" };
      }
      return { pageNumber, text: this.toPageText(item.value as PaddleOcrResult) };
    });
  }

  private toPageText(result: PaddleOcrResult): string {
    const lines: string[] = [];
    for (const line of result.lines) {
      const kept = line
        .filter((item) => item.confidence >= PaddleOcrTextExtractor.MIN_CONFIDENCE)
        .map((item) => this.textNormalizer.canonicalize(item.text).trim())
        .filter((text) => text.length > 0);
      if (kept.length > 0) lines.push(kept.join(" "));
    }
    return lines.join("\n");
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
