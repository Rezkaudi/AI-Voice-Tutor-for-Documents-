import type { PageExtractionEvent } from "@/application/dto/page-extraction-event";
import { AsyncEventQueue } from "@/application/services/async-event-queue";
import type { DocumentPagesStore } from "@/application/services/document-pages-store";
import type { ExtractionRegistry } from "@/application/services/extraction-registry";
import type { DocumentPagesFile } from "@/domain/entities/document-pages";
import { NotFoundError } from "@/domain/errors/app-error";
import type { DocumentRepository } from "@/domain/repositories/document-repository";
import type { DocumentTextExtractor } from "@/domain/services/document-text-extractor";
import type { FileStorage } from "@/domain/services/file-storage";
import type { Logger } from "@/domain/services/logger";

export interface ExtractDocumentPagesInput {
  readonly userId: string;
  readonly documentId: string;
}

const HEARTBEAT_MS = 15_000;
const WATCH_INTERVAL_MS = 2_000;

export class ExtractDocumentPagesUseCase {
  constructor(
    private readonly repository: DocumentRepository,
    private readonly storage: FileStorage,
    private readonly extractor: DocumentTextExtractor,
    private readonly pagesStore: DocumentPagesStore,
    private readonly registry: ExtractionRegistry,
    private readonly logger: Logger,
    private readonly batchSize: number,
  ) { }

  async execute(
    input: ExtractDocumentPagesInput,
    signal: AbortSignal
  ): Promise<AsyncIterable<PageExtractionEvent>> {
    const document = await this.repository.findById(input.documentId, input.userId);
    if (!document) {
      throw new NotFoundError("Document not found.");
    }

    const queue = new AsyncEventQueue<PageExtractionEvent>();
    void this.run(input, document.storagePath, document.pageCount, signal, queue);
    return queue;
  }

  private async run(
    input: ExtractDocumentPagesInput,
    storagePath: string,
    pageCount: number,
    signal: AbortSignal,
    queue: AsyncEventQueue<PageExtractionEvent>
  ): Promise<void> {
    const log = this.logger.scope("extract-stream");
    const { userId, documentId } = input;
    const heartbeat = setInterval(() => queue.push({ event: "ping", data: {} }), HEARTBEAT_MS);
    try {
      let known = (await this.pagesStore.read(userId, documentId))?.file ?? null;
      queue.push(snapshotEvent(known, pageCount, this.extractingPagesFor(documentId, known, pageCount)));
      if (known?.done) {
        queue.push({ event: "done", data: {} });
        return;
      }
      if (signal.aborted) return;

      if (this.registry.acquire(documentId)) {
        try {
          await this.drive(input, storagePath, pageCount, signal, queue, known, log);
        } finally {
          this.registry.release(documentId);
        }
      } else {
        await this.watch(input, storagePath, pageCount, signal, queue, known, log);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Extraction failed.";
      log.error(`document ${documentId} · extraction stream failed`, error);
      queue.push({ event: "error", data: { error: message } });
    } finally {
      clearInterval(heartbeat);
      queue.end();
    }
  }

  private async drive(
    input: ExtractDocumentPagesInput,
    storagePath: string,
    pageCount: number,
    signal: AbortSignal,
    queue: AsyncEventQueue<PageExtractionEvent>,
    known: DocumentPagesFile | null,
    log: Logger
  ): Promise<void> {
    const { userId, documentId } = input;
    const file = await this.storage.get(storagePath);
    if (!file) {
      throw new NotFoundError("The document file could not be found.");
    }
    log.info(`document ${documentId} · driving extraction of ${pageCount} page(s)`);

    let batch: number[] = [];
    for (let page = 1; page <= pageCount; page += 1) {
      if (isKnown(known, page)) continue;
      if (signal.aborted) {
        log.info(`document ${documentId} · client disconnected · pausing at page ${page}`);
        return;
      }
      batch.push(page);
      if (batch.length >= this.normalizedBatchSize()) {
        known = await this.extractBatch(file.body, batch, input, pageCount, queue, log);
        batch = [];
      }
    }

    if (batch.length > 0 && !signal.aborted) {
      known = await this.extractBatch(file.body, batch, input, pageCount, queue, log);
    }

    if (known?.done) {
      log.info(`document ${documentId} · extraction complete`);
      queue.push({ event: "done", data: {} });
    }
  }

  private async extractBatch(
    file: Buffer,
    pages: number[],
    input: ExtractDocumentPagesInput,
    pageCount: number,
    queue: AsyncEventQueue<PageExtractionEvent>,
    log: Logger
  ): Promise<DocumentPagesFile | null> {
    const { userId, documentId } = input;
    this.registry.setActivePages(documentId, pages);
    for (const page of pages) {
      queue.push({ event: "page-start", data: { page } });
    }

    try {
      const extracted = await this.extractor.extractPages(file, pages);
      const textByPage = new Map(extracted.map((page) => [page.pageNumber, page.text]));
      const known = await this.pagesStore.mergePages(
        userId,
        documentId,
        pages.map((pageNumber) => ({
          pageNumber,
          text: textByPage.get(pageNumber) ?? ""
        })),
        { pageCount }
      );
      for (const page of pages) {
        queue.push({ event: "page-ready", data: { page } });
      }
      return known;
    } catch (error) {
      log.warn(`document ${documentId} · batch [${pages.join(", ")}] extraction failed`, error);
      return this.extractBatchOneByOne(file, pages, input, pageCount, queue, log);
    } finally {
      this.registry.clearActivePages(documentId);
    }
  }

  private async extractBatchOneByOne(
    file: Buffer,
    pages: number[],
    input: ExtractDocumentPagesInput,
    pageCount: number,
    queue: AsyncEventQueue<PageExtractionEvent>,
    log: Logger
  ): Promise<DocumentPagesFile | null> {
    const { userId, documentId } = input;
    let known: DocumentPagesFile | null = null;
    for (const page of pages) {
      try {
        const extracted = await this.extractor.extractPages(file, [page]);
        const text = extracted.find((item) => item.pageNumber === page)?.text ?? "";
        known = await this.pagesStore.mergePages(
          userId,
          documentId,
          [{ pageNumber: page, text }],
          { pageCount }
        );
        queue.push({ event: "page-ready", data: { page } });
      } catch (error) {
        log.warn(`document ${documentId} · page ${page} extraction failed`, error);
        known = await this.pagesStore.mergePages(userId, documentId, [], {
          pageCount,
          failedPages: [page]
        });
        queue.push({ event: "page-failed", data: { page } });
      }
    }
    return known;
  }

  private normalizedBatchSize(): number {
    const size = Math.floor(this.batchSize);
    return Number.isFinite(size) && size >= 1 ? size : 1;
  }

  private async watch(
    input: ExtractDocumentPagesInput,
    storagePath: string,
    pageCount: number,
    signal: AbortSignal,
    queue: AsyncEventQueue<PageExtractionEvent>,
    known: DocumentPagesFile | null,
    log: Logger
  ): Promise<void> {
    const { userId, documentId } = input;
    log.info(`document ${documentId} · another stream is driving · watching pages.json`);
    let seenPages = new Set(extractedPages(known));
    let seenFailed = new Set(known?.failed ?? []);
    let seenStarted = new Set(this.registry.activePages(documentId));

    while (!signal.aborted) {
      await abortableSleep(WATCH_INTERVAL_MS, signal);
      if (signal.aborted) return;

      if (this.registry.acquire(documentId)) {
        try {
          const latest = (await this.pagesStore.read(userId, documentId))?.file ?? null;
          await this.drive(input, storagePath, pageCount, signal, queue, latest, log);
        } finally {
          this.registry.release(documentId);
        }
        return;
      }

      for (const page of this.registry.activePages(documentId)) {
        if (!seenStarted.has(page)) {
          queue.push({ event: "page-start", data: { page } });
          seenStarted.add(page);
        }
      }

      const latest = (await this.pagesStore.read(userId, documentId))?.file ?? null;
      for (const page of extractedPages(latest)) {
        if (!seenPages.has(page)) {
          queue.push({ event: "page-ready", data: { page } });
        }
      }
      for (const page of latest?.failed ?? []) {
        if (!seenFailed.has(page)) {
          queue.push({ event: "page-failed", data: { page } });
        }
      }
      seenPages = new Set(extractedPages(latest));
      seenFailed = new Set(latest?.failed ?? []);
      if (latest?.done) {
        queue.push({ event: "done", data: {} });
        return;
      }
    }
  }

  private extractingPagesFor(
    documentId: string,
    file: DocumentPagesFile | null,
    pageCount: number
  ): number[] {
    const active = this.registry.activePages(documentId);
    if (active.length > 0) return active;
    if (file?.done) return [];
    return nextMissingPages(file, pageCount, this.normalizedBatchSize());
  }
}

function snapshotEvent(
  file: DocumentPagesFile | null,
  pageCount: number,
  extracting: number[]
): PageExtractionEvent {
  return {
    event: "progress",
    data: {
      pageCount: file?.pageCount || pageCount,
      extracted: extractedPages(file),
      failed: file?.failed ?? [],
      extracting,
      done: file?.done ?? false
    }
  };
}

function extractedPages(file: DocumentPagesFile | null): number[] {
  if (!file) return [];
  return Object.keys(file.pages)
    .map(Number)
    .filter((page) => Number.isInteger(page) && page >= 1)
    .sort((a, b) => a - b);
}

function isKnown(file: DocumentPagesFile | null, page: number): boolean {
  if (!file) return false;
  return file.pages[String(page)] !== undefined || file.failed.includes(page);
}

function nextMissingPages(
  file: DocumentPagesFile | null,
  pageCount: number,
  batchSize: number
): number[] {
  const pages: number[] = [];
  for (let page = 1; page <= pageCount && pages.length < batchSize; page += 1) {
    if (!isKnown(file, page)) pages.push(page);
  }
  return pages;
}

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
