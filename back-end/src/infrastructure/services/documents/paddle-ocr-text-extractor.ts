import { createHash } from "node:crypto";

import type { PaddleOcrService, PaddleOcrResult, ModelUrls } from "ppu-paddle-ocr";

import type { DocumentPage, UploadKind } from "@/domain/entities/document";
import type { DocumentTextExtractor } from "@/domain/services/document-text-extractor";
import type { Logger } from "@/domain/services/logger";
import { TextNormalizer } from "@/domain/logic/citation/text-normalizer";
import { ReadingOrderBuilder } from "@/domain/logic/pdf/reading-order-builder";
import { ScriptDirection } from "@/domain/logic/pdf/script-direction";
import { OcrScriptDetector } from "@/domain/logic/pdf/ocr-script-detector";
import { RtlVisualOrderConverter } from "@/domain/logic/pdf/rtl-visual-order-converter";
import type { LayoutRegion, PositionedOcrItem } from "@/domain/logic/pdf/layout-region";
import { DocLayoutRegionDetector } from "@/infrastructure/services/documents/doclayout-region-detector";
import { PdfiumPageRenderer } from "@/infrastructure/services/documents/pdfium-page-renderer";

type ModelChoice = "default" | "arabic";

export class PaddleOcrTextExtractor implements DocumentTextExtractor {
  private static readonly MIN_CONFIDENCE = 0.5;
  private static readonly MAX_SIDE_LENGTH = 1536;
  private static readonly PROBE_PAGE_COUNT = 3;

  private readonly services = new Map<ModelChoice, Promise<PaddleOcrService>>();
  private readonly modelChoice = new Map<string, ModelChoice>();

  constructor(
    private readonly renderer: PdfiumPageRenderer,
    private readonly layoutDetector: DocLayoutRegionDetector,
    private readonly readingOrder: ReadingOrderBuilder,
    private readonly textNormalizer: TextNormalizer,
    private readonly scriptDirection: ScriptDirection,
    private readonly rtlConverter: RtlVisualOrderConverter,
    private readonly scriptDetector: OcrScriptDetector,
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
    const choice = await this.chooseModel(buffer, log);
    const layoutsPromise = this.detectLayouts(rendered, log);
    const service = await this.service(choice);

    const started = Date.now();
    const results = await service.batchRecognize(
      rendered.map((page) => page.png),
      { settle: true, noCache: true }
    );
    log.info(`recognized ${rendered.length} page(s) with ${choice} model in ${Date.now() - started}ms`);
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

  private async chooseModel(buffer: Buffer, log: Logger): Promise<ModelChoice> {
    const key = this.fingerprint(buffer);
    const cached = this.modelChoice.get(key);
    if (cached) return cached;

    const choice = await this.detectModel(buffer, log);
    this.modelChoice.set(key, choice);
    return choice;
  }

  private async detectModel(buffer: Buffer, log: Logger): Promise<ModelChoice> {
    try {
      const total = await this.renderer.countPages(buffer);
      const probePages = Array.from(
        { length: Math.min(PaddleOcrTextExtractor.PROBE_PAGE_COUNT, total) },
        (_, index) => index + 1
      );
      const rendered = await this.renderer.renderPages(buffer, probePages);
      if (rendered.length === 0) return "default";

      const service = await this.service("default");
      const results = await service.batchRecognize(
        rendered.map((page) => page.png),
        { settle: true, noCache: true }
      );
      const samples = results.flatMap((item) =>
        item.status === "fulfilled"
          ? (item.value as PaddleOcrResult).lines.flat().map((line) => ({
            text: line.text,
            confidence: line.confidence
          }))
          : []
      );

      const choice: ModelChoice = this.scriptDetector.defaultModelFailed(samples) ? "arabic" : "default";
      log.info(`auto-detected script → ${choice} model (probed ${rendered.length} page(s))`);
      return choice;
    } catch (error) {
      log.warn("script auto-detection failed, using default model", error);
      return "default";
    }
  }

  private fingerprint(buffer: Buffer): string {
    const sampleSize = Math.min(4096, buffer.length);
    const hash = createHash("sha1");
    hash.update(String(buffer.length));
    hash.update(buffer.subarray(0, sampleSize));
    hash.update(buffer.subarray(buffer.length - sampleSize));
    return hash.digest("hex");
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
      const raw = line.map((item) => item.text);
      const oriented = this.scriptDirection.isRightToLeft(raw.join(" "))
        ? raw.map((text) => this.rtlConverter.toLogical(text)).reverse()
        : raw;
      const texts = oriented
        .map((text) => this.cleanOcrText(text))
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

  private service(choice: ModelChoice): Promise<PaddleOcrService> {
    const existing = this.services.get(choice);
    if (existing) return existing;

    const promise = this.loadService(choice).catch((error) => {
      // Allow a retry on the next request instead of caching the failure.
      this.services.delete(choice);
      throw error;
    });
    this.services.set(choice, promise);
    return promise;
  }

  private async loadService(choice: ModelChoice): Promise<PaddleOcrService> {
    const log = this.logger.scope("paddle-ocr");
    const { PaddleOcrService: Service, V5_ARABIC_MOBILE_MODEL } = await import("ppu-paddle-ocr");
    const model: ModelUrls | undefined = choice === "arabic" ? V5_ARABIC_MOBILE_MODEL : undefined;
    log.info(
      choice === "arabic"
        ? "loading PP-OCRv5 Arabic models (downloaded and cached on first run)"
        : "loading PP-OCRv6 models (downloaded and cached on first run)"
    );
    const service = new Service({
      ...(model ? { model } : {}),
      detection: { maxSideLength: PaddleOcrTextExtractor.MAX_SIDE_LENGTH },
      debugging: { debug: false, verbose: false }
    });
    await service.initialize();
    log.info(`${choice} models ready`);
    return service;
  }
}
