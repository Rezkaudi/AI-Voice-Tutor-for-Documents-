import type { PageExtractionEvent } from "@/application/dto/page-extraction-event";
import { AsyncEventQueue } from "@/application/services/async-event-queue";
import type { DocumentPagesStore } from "@/application/services/document-pages-store";
import type { ExtractionLease } from "@/application/services/extraction-lease";
import type { PageExtractionDriver } from "@/application/services/page-extraction-driver";
import type { PageExtractionSession } from "@/application/services/page-extraction-session";
import type { PageExtractionWatcher } from "@/application/services/page-extraction-watcher";
import type { DocumentPagesFile } from "@/domain/entities/document-pages";
import { extractedPages, pagesNeedingWork } from "@/domain/entities/document-pages";
import { NotFoundError } from "@/domain/errors/app-error";
import type { DocumentRepository } from "@/domain/repositories/document-repository";
import type { ExtractionQueue } from "@/domain/services/extraction-queue";
import type { Logger } from "@/domain/services/logger";

export interface ExtractDocumentPagesInput {
  readonly userId: string;
  readonly documentId: string;
}

const HEARTBEAT_MS = 15_000;

export class ExtractDocumentPagesUseCase {
  constructor(
    private readonly repository: DocumentRepository,
    private readonly pagesStore: DocumentPagesStore,
    private readonly lease: ExtractionLease,
    private readonly extractionQueue: ExtractionQueue,
    private readonly watcher: PageExtractionWatcher,
    private readonly driver: PageExtractionDriver,
    private readonly logger: Logger,
    private readonly maxPageAttempts: number
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
    void this.run({
      userId: input.userId,
      documentId: input.documentId,
      storagePath: document.storagePath,
      pageCount: document.pageCount,
      signal,
      queue,
      log: this.logger.scope("extract-stream")
    });
    return queue;
  }

  private async run(session: PageExtractionSession): Promise<void> {
    const { userId, documentId, pageCount, signal, queue, log } = session;
    const heartbeat = setInterval(() => queue.push({ event: "ping", data: {} }), HEARTBEAT_MS);
    try {
      const known = (await this.pagesStore.read(userId, documentId))?.file ?? null;
      queue.push(await this.snapshot(session, known));

      if (pagesNeedingWork(known, pageCount, this.maxPageAttempts).length === 0) {
        queue.push({ event: "done", data: {} });
        return;
      }
      if (signal.aborted) return;

      try {
        await this.extractionQueue.enqueue(
          { userId, documentId },
          { dedupeKey: `extract-${documentId}-${Math.floor(Date.now() / 60_000)}` }
        );
      } catch (error) {
        log.warn(`document ${documentId} · could not queue extraction`, error);
      }

      await this.watcher.follow(session, known);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Extraction failed.";
      log.error(`document ${documentId} · extraction stream failed`, error);
      queue.push({ event: "error", data: { error: message } });
    } finally {
      clearInterval(heartbeat);
      queue.end();
    }
  }

  private async snapshot(
    session: PageExtractionSession,
    file: DocumentPagesFile | null
  ): Promise<PageExtractionEvent> {
    return {
      event: "progress",
      data: {
        pageCount: file?.pageCount || session.pageCount,
        extracted: extractedPages(file),
        failed: file?.failed ?? [],
        extracting: await this.extractingPages(session, file),
        done: file?.done ?? false
      }
    };
  }

  private async extractingPages(
    session: PageExtractionSession,
    file: DocumentPagesFile | null
  ): Promise<number[]> {
    const active = await this.lease.activePages(session.userId, session.documentId);
    if (active.length > 0) return active;
    if (file?.done) return [];
    return this.driver.nextBatch(file, session.pageCount);
  }
}
