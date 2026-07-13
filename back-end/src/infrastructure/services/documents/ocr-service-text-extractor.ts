import type { EnvConfig } from "@/config/env.config";
import type { DocumentPage, UploadKind } from "@/domain/entities/document";
import type { DocumentTextExtractor } from "@/domain/services/document-text-extractor";
import type { Logger } from "@/domain/services/logger";
import { TextNormalizer } from "@/domain/logic/citation/text-normalizer";
import { PdfiumPageRenderer } from "@/infrastructure/services/documents/pdfium-page-renderer";

interface OcrServiceResponse {
  engine: string;
  language: string | null;
  elapsed_ms: number;
  text: string;
  lines: { text: string; confidence: number; box: number[] }[];
}

export class OcrServiceTextExtractor implements DocumentTextExtractor {
  constructor(
    private readonly config: EnvConfig,
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

    const log = this.logger.scope("ocr-service");
    if (!this.config.OCR_SERVICE_URL) {
      log.error("OCR_SERVICE_URL is not set — cannot reach the OCR sidecar");
    }

    const started = Date.now();
    const pages = await this.mapWithConcurrency(
      rendered,
      Math.max(1, this.config.OCR_SERVICE_CONCURRENCY),
      async (page) => ({
        pageNumber: page.pageNumber,
        text: await this.recognize(page.pageNumber, page.png, log)
      })
    );
    log.info(`recognized ${rendered.length} page(s) via ocr-service in ${Date.now() - started}ms`);
    return pages.sort((a, b) => a.pageNumber - b.pageNumber);
  }

  private async recognize(pageNumber: number, png: ArrayBuffer, log: Logger): Promise<string> {
    const form = new FormData();
    form.append("file", new Blob([png], { type: "image/png" }), `page-${pageNumber}.png`);
    if (this.config.OCR_SERVICE_LANGUAGE) form.append("language", this.config.OCR_SERVICE_LANGUAGE);

    try {
      const response = await fetch(`${this.config.OCR_SERVICE_URL}/ocr`, {
        method: "POST",
        body: form
      });
      if (!response.ok) {
        log.error(`page ${pageNumber} failed: HTTP ${response.status} ${await response.text()}`);
        return "";
      }
      const result = (await response.json()) as OcrServiceResponse;
      return this.textNormalizer.canonicalize(result.text ?? "").trim();
    } catch (error) {
      log.error(`page ${pageNumber} failed`, error);
      return "";
    }
  }

  private async mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    worker: (item: T) => Promise<R>
  ): Promise<R[]> {
    const results = new Array<R>(items.length);
    let cursor = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await worker(items[index]!);
      }
    });
    await Promise.all(runners);
    return results;
  }
}
