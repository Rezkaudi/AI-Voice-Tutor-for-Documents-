import type { DocumentPagesStore } from "@/application/services/document-pages-store";
import {
  abortableSleep,
  type PageExtractionSession
} from "@/application/services/page-extraction-session";
import { PageWriteBuffer } from "@/application/services/page-write-buffer";
import type { DocumentPagesFile } from "@/domain/entities/document-pages";
import { pagesNeedingWork } from "@/domain/entities/document-pages";
import { NotFoundError } from "@/domain/errors/app-error";
import type { DocumentTextExtractor } from "@/domain/services/document-text-extractor";
import type { FileStorage } from "@/domain/services/file-storage";

export interface PageExtractionDriverOptions {
  /** Pages per OCR request. Keep at 1 — see DEFAULT_PAGE_EXTRACTION_BATCH_SIZE. */
  readonly batchSize: number;
  /** OCR requests in flight at once. This is what sets throughput. */
  readonly concurrency: number;
  readonly sourceUrlTtlSeconds: number;
  readonly maxPageAttempts: number;
  readonly flushEveryPages: number;
  readonly flushEveryMs: number;
  readonly activeReportIntervalMs: number;
}

export class PageExtractionDriver {
  constructor(
    private readonly storage: FileStorage,
    private readonly extractor: DocumentTextExtractor,
    private readonly pagesStore: DocumentPagesStore,
    private readonly options: PageExtractionDriverOptions
  ) { }

  nextBatch(file: DocumentPagesFile | null, pageCount: number): number[] {
    return pagesNeedingWork(file, pageCount, this.options.maxPageAttempts).slice(
      0,
      this.normalized(this.options.batchSize)
    );
  }

  async drive(session: PageExtractionSession, known: DocumentPagesFile | null): Promise<void> {
    const { documentId, pageCount, signal, queue, log } = session;
    if (!(await this.storage.head(session.storagePath))) {
      throw new NotFoundError("The document file could not be found.");
    }

    const pdfUrl = await this.storage.presignGet(session.storagePath, {
      expiresInSeconds: this.options.sourceUrlTtlSeconds,
      contentType: "application/pdf"
    });

    // Resolve the script once. The OCR service otherwise re-probes two pages
    // with the default model on every instance that has not seen this PDF
    // before — the probe result is identical, it was just being recomputed
    // dozens of times inside real request latency.
    const model = await this.resolveModel(pdfUrl, session);

    const buffer = new PageWriteBuffer(
      this.pagesStore,
      session.userId,
      documentId,
      pageCount,
      this.options.maxPageAttempts,
      known,
      {
        flushEveryPages: this.options.flushEveryPages,
        flushEveryMs: this.options.flushEveryMs
      }
    );

    const concurrency = this.normalized(this.options.concurrency);
    log.info(
      `document ${documentId} · driving extraction of ${pageCount} page(s) · ` +
      `${concurrency} worker(s) × ${this.normalized(this.options.batchSize)} page(s)/request` +
      `${model ? ` · model=${model}` : ""}`
    );

    const active = new Set<number>();
    const stopReporting = this.reportActivePeriodically(session, active);

    try {
      for (let pass = 0; !signal.aborted; pass += 1) {
        const targets = buffer.pending();
        if (targets.length === 0) break;

        if (pass > 0) {
          log.info(
            `document ${documentId} · retry pass ${pass} · ${targets.length} page(s) still pending`
          );
          await abortableSleep(this.retryBackoffMs(pass), signal);
          if (signal.aborted) break;
        }

        await this.runPool(session, pdfUrl, targets, buffer, model, active);
        await buffer.flush();
      }
    } finally {
      stopReporting();
      // Persist whatever the pool finished before the budget ran out, then
      // clear the lease's active-page list so watchers stop showing them.
      await buffer.flush().catch((error) => {
        log.error(`document ${documentId} · could not persist extracted pages`, error);
      });
      await (session.reportActive?.([]) ?? Promise.resolve(true)).catch(() => undefined);
    }

    const remaining = buffer.pending().length;
    if (signal.aborted && remaining > 0) {
      log.info(`document ${documentId} · extraction paused · ${remaining} page(s) left`);
      return;
    }

    if (buffer.snapshot?.done) {
      log.info(`document ${documentId} · extraction complete`);
      queue.push({ event: "done", data: {} });
    }
  }

  /**
   * Runs `concurrency` workers over a shared cursor. A worker that finishes a
   * fast page immediately takes the next one instead of idling until every
   * page in a fixed batch is done, so throughput tracks the *average* page
   * latency rather than the slowest page in each group.
   */
  private async runPool(
    session: PageExtractionSession,
    pdfUrl: string,
    targets: readonly number[],
    buffer: PageWriteBuffer,
    model: string | null,
    active: Set<number>
  ): Promise<void> {
    const size = this.normalized(this.options.batchSize);
    let cursor = 0;
    const take = (): number[] => {
      const slice = targets.slice(cursor, cursor + size);
      cursor += slice.length;
      return [...slice];
    };

    const worker = async (): Promise<void> => {
      for (let batch = take(); batch.length > 0; batch = take()) {
        if (session.signal.aborted) return;
        await this.extractBatch(session, pdfUrl, batch, buffer, model, active);
      }
    };

    await Promise.all(
      Array.from({ length: this.normalized(this.options.concurrency) }, () => worker())
    );
  }

  private async extractBatch(
    session: PageExtractionSession,
    pdfUrl: string,
    pages: number[],
    buffer: PageWriteBuffer,
    model: string | null,
    active: Set<number>
  ): Promise<void> {
    const { documentId, queue, log } = session;
    for (const page of pages) {
      active.add(page);
      queue.push({ event: "page-start", data: { page } });
    }

    try {
      const extracted = await this.extractor.extractPages(pdfUrl, pages, {
        ...(model ? { model } : {}),
        signal: session.signal
      });
      const textByPage = new Map(extracted.map((page) => [page.pageNumber, page.text]));
      await buffer.recordExtracted(
        pages.map((pageNumber) => ({
          pageNumber,
          text: textByPage.get(pageNumber) ?? ""
        }))
      );
      for (const page of pages) {
        queue.push({ event: "page-ready", data: { page } });
      }
    } catch (error) {
      if (session.signal.aborted) return;
      log.warn(`document ${documentId} · batch [${pages.join(", ")}] extraction failed`, error);
      await this.extractPagesIndividually(session, pdfUrl, pages, buffer, model);
    } finally {
      for (const page of pages) active.delete(page);
    }
  }

  /**
   * A failed batch is retried page by page so one unreadable page cannot cost
   * an attempt for the healthy pages sharing its request.
   */
  private async extractPagesIndividually(
    session: PageExtractionSession,
    pdfUrl: string,
    pages: number[],
    buffer: PageWriteBuffer,
    model: string | null
  ): Promise<void> {
    const { documentId, queue, log } = session;
    for (const page of pages) {
      if (session.signal.aborted) return;
      try {
        const extracted = await this.extractor.extractPages(pdfUrl, [page], {
          ...(model ? { model } : {}),
          signal: session.signal
        });
        const text = extracted.find((item) => item.pageNumber === page)?.text ?? "";
        await buffer.recordExtracted([{ pageNumber: page, text }]);
        queue.push({ event: "page-ready", data: { page } });
      } catch (error) {
        if (session.signal.aborted) return;
        log.warn(`document ${documentId} · page ${page} extraction failed`, error);
        await buffer.recordFailed([page]);
        queue.push({ event: "page-failed", data: { page } });
      }
    }
  }

  /**
   * Publishes the in-flight page set to the lease on a timer.
   *
   * This used to be written once per batch. With a worker pool that would be
   * one S3 compare-and-set per worker per batch, all against the same lock
   * object — a write storm that scales with concurrency and buys nothing,
   * since the only consumer polls every two seconds anyway.
   */
  private reportActivePeriodically(
    session: PageExtractionSession,
    active: Set<number>
  ): () => void {
    const report = session.reportActive;
    if (!report) return () => undefined;

    let inFlight = false;
    const publish = (): void => {
      if (inFlight) return;
      inFlight = true;
      void report([...active].sort((a, b) => a - b))
        .catch(() => undefined)
        .finally(() => {
          inFlight = false;
        });
    };

    const timer = setInterval(publish, Math.max(1_000, this.options.activeReportIntervalMs));
    return () => clearInterval(timer);
  }

  private async resolveModel(
    pdfUrl: string,
    session: PageExtractionSession
  ): Promise<string | null> {
    if (!this.extractor.resolveModel) return null;
    try {
      return await this.extractor.resolveModel(pdfUrl, session.signal);
    } catch {
      // Detection is an optimisation. Falling through leaves the OCR service
      // detecting per request, exactly as it did before.
      return null;
    }
  }

  private retryBackoffMs(pass: number): number {
    return Math.min(30_000, 2_000 * 2 ** (pass - 1));
  }

  private normalized(value: number): number {
    const size = Math.floor(value);
    return Number.isFinite(size) && size >= 1 ? size : 1;
  }
}
