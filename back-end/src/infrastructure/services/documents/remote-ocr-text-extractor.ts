import type { EnvConfig } from "@/config/env.config";
import type { DocumentPage } from "@/domain/entities/document";
import type { DocumentTextExtractor } from "@/domain/services/document-text-extractor";
import type { Logger } from "@/domain/services/logger";

interface RemotePage {
  page_number: number;
  text: string;
}
interface ExtractResponse {
  pages: RemotePage[];
}

export class RemoteOcrTextExtractor implements DocumentTextExtractor {
  constructor(
    private readonly config: EnvConfig,
    private readonly logger: Logger
  ) { }

  async extractPages(pdfUrl: string, pageNumbers: number[]): Promise<DocumentPage[]> {
    if (pageNumbers.length === 0) return [];

    const started = Date.now();
    const results = await Promise.all(
      pageNumbers.map((pageNumber) =>
        this.call<ExtractResponse>("/extract-pages", { url: pdfUrl, pages: [pageNumber] })
      )
    );
    const pages = results.flatMap((result) => result.pages);
    this.logger
      .scope("remote-ocr")
      .info(`extracted ${pages.length} page(s) via s3-url in ${Date.now() - started}ms (parallel)`);

    return pages
      .map((page) => ({ pageNumber: page.page_number, text: page.text }))
      .sort((a, b) => a.pageNumber - b.pageNumber);
  }

  private async call<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.OCR_SERVICE_TIMEOUT_MS);
    try {
      const response = await fetch(`${this.config.OCR_SERVICE_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`OCR function ${path} → ${response.status} ${detail}`);
      }
      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}
