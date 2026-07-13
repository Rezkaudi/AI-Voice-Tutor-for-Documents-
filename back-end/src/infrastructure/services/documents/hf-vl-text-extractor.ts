import OpenAI from "openai";

import type { EnvConfig } from "@/config/env.config";
import type { DocumentPage, UploadKind } from "@/domain/entities/document";
import type { DocumentTextExtractor } from "@/domain/services/document-text-extractor";
import type { Logger } from "@/domain/services/logger";
import type { TextNormalizer } from "@/domain/logic/citation/text-normalizer";
import { PdfiumPageRenderer } from "@/infrastructure/services/documents/pdfium-page-renderer";

export class HfVlTextExtractor implements DocumentTextExtractor {
  private static readonly PROMPT =
    "Transcribe every piece of text on this page exactly as written, in natural " +
    "reading order (top-to-bottom, and right-to-left for Arabic/Hebrew). Preserve " +
    "line breaks and paragraph structure. Do NOT translate, summarize, describe " +
    "images, or add any commentary or markdown code fences. Output only the raw " +
    "text. If the page has no readable text, output nothing.";

  private readonly client: OpenAI;

  constructor(
    private readonly config: EnvConfig,
    private readonly renderer: PdfiumPageRenderer,
    private readonly textNormalizer: TextNormalizer,
    private readonly logger: Logger
  ) {
    this.client = new OpenAI({
      apiKey: config.HF_TOKEN,
      baseURL: config.HF_VL_BASE_URL
    });
  }

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

    const log = this.logger.scope("hf-vl-ocr");
    if (!this.config.HF_TOKEN) {
      log.error("HF_TOKEN is not set — cannot call the HF vision-language Inference API");
    }

    const started = Date.now();
    const pages = await this.mapWithConcurrency(
      rendered,
      Math.max(1, this.config.HF_VL_CONCURRENCY),
      async (page) => ({
        pageNumber: page.pageNumber,
        text: await this.transcribe(page.pageNumber, page.png, log)
      })
    );
    log.info(
      `recognized ${rendered.length} page(s) with ${this.config.HF_VL_MODEL} in ${Date.now() - started}ms`
    );
    return pages.sort((a, b) => a.pageNumber - b.pageNumber);
  }

  private async transcribe(pageNumber: number, png: ArrayBuffer, log: Logger): Promise<string> {
    const dataUrl = `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
    try {
      const completion = await this.client.chat.completions.create({
        model: this.config.HF_VL_MODEL,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: HfVlTextExtractor.PROMPT },
              { type: "image_url", image_url: { url: dataUrl } }
            ]
          }
        ]
      });
      const raw = completion.choices[0]?.message?.content ?? "";
      return this.clean(raw);
    } catch (error) {
      log.error(`page ${pageNumber} failed`, error);
      return "";
    }
  }

  private clean(value: string): string {
    // Strip stray markdown fences the model sometimes wraps output in, then
    // run the same canonicalization the rest of the pipeline expects.
    const unfenced = value
      .replace(/^\s*```(?:\w+)?\s*/u, "")
      .replace(/\s*```\s*$/u, "");
    return this.textNormalizer.canonicalize(unfenced).trim();
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
