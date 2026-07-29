import type { DocumentPagesStore } from "@/application/services/document-pages-store";
import {
  abortableSleep,
  type PageExtractionSession
} from "@/application/services/page-extraction-session";
import type { DocumentPagesFile } from "@/domain/entities/document-pages";
import { pagesNeedingWork } from "@/domain/entities/document-pages";
import { NotFoundError } from "@/domain/errors/app-error";
import type { DocumentTextExtractor } from "@/domain/services/document-text-extractor";
import type { FileStorage } from "@/domain/services/file-storage";

export class PageExtractionDriver {
  constructor(
    private readonly storage: FileStorage,
    private readonly extractor: DocumentTextExtractor,
    private readonly pagesStore: DocumentPagesStore,
    private readonly batchSize: number,
    private readonly sourceUrlTtlSeconds: number,
    private readonly maxPageAttempts: number
  ) { }

  nextBatch(file: DocumentPagesFile | null, pageCount: number): number[] {
    return this.pending(file, pageCount).slice(0, this.normalizedBatchSize());
  }

  async drive(session: PageExtractionSession, known: DocumentPagesFile | null): Promise<void> {
    const { documentId, pageCount, signal, queue, log } = session;
    if (!(await this.storage.head(session.storagePath))) {
      throw new NotFoundError("The document file could not be found.");
    }

    const pdfUrl = await this.storage.presignGet(session.storagePath, {
      expiresInSeconds: this.sourceUrlTtlSeconds,
      contentType: "application/pdf"
    });
    log.info(`document ${documentId} · driving extraction of ${pageCount} page(s)`);

    try {
      for (let pass = 0; !signal.aborted; pass += 1) {
        const targets = this.pending(known, pageCount);
        if (targets.length === 0) break;

        if (pass > 0) {
          log.info(
            `document ${documentId} · retry pass ${pass} · ${targets.length} page(s) still pending`
          );
          // Back off before retrying so transient rate limits have time to clear.
          await abortableSleep(this.retryBackoffMs(pass), signal);
          if (signal.aborted) return;
        }

        for (let i = 0; i < targets.length; i += this.normalizedBatchSize()) {
          if (signal.aborted) {
            log.info(`document ${documentId} · extraction paused · ${targets.length - i} page(s) left`);
            return;
          }
          const batch = targets.slice(i, i + this.normalizedBatchSize());
          known = await this.extractBatch(session, pdfUrl, batch);
        }
      }
    } finally {
      await session.reportActive?.([]);
    }

    if (known?.done) {
      log.info(`document ${documentId} · extraction complete`);
      queue.push({ event: "done", data: {} });
    }
  }

  private async extractBatch(
    session: PageExtractionSession,
    pdfUrl: string,
    pages: number[]
  ): Promise<DocumentPagesFile | null> {
    const { userId, documentId, pageCount, queue, log } = session;
    await session.reportActive?.(pages);
    for (const page of pages) {
      queue.push({ event: "page-start", data: { page } });
    }

    try {
      const extracted = await this.extractor.extractPages(pdfUrl, pages);
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
      return this.extractPagesIndividually(session, pdfUrl, pages);
    }
  }

  private async extractPagesIndividually(
    session: PageExtractionSession,
    pdfUrl: string,
    pages: number[]
  ): Promise<DocumentPagesFile | null> {
    const { userId, documentId, pageCount, queue, log } = session;
    let known: DocumentPagesFile | null = null;
    for (const page of pages) {
      try {
        const extracted = await this.extractor.extractPages(pdfUrl, [page]);
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

  private pending(file: DocumentPagesFile | null, pageCount: number): number[] {
    return pagesNeedingWork(file, pageCount, this.maxPageAttempts);
  }

  private retryBackoffMs(pass: number): number {
    return Math.min(30_000, 2_000 * 2 ** (pass - 1));
  }

  private normalizedBatchSize(): number {
    const size = Math.floor(this.batchSize);
    return Number.isFinite(size) && size >= 1 ? size : 1;
  }
}
