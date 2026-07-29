import type { DocumentPagesStore, PageEntry } from "@/application/services/document-pages-store";
import type { DocumentPagesFile } from "@/domain/entities/document-pages";
import { pagesNeedingWork } from "@/domain/entities/document-pages";

export interface PageWriteBufferOptions {
  readonly flushEveryPages: number;
  readonly flushEveryMs: number;
}

/**
 * Coalescing, serialised writer for a document's `pages.json`.
 *
 * `DocumentPagesStore.mergePages` is a read-modify-write of one S3 object
 * guarded by an ETag compare-and-set. Calling it once per finished batch was
 * fine while a single batch was ever in flight, but with a worker pool every
 * worker would contend on the same object, exhaust MAX_MERGE_ATTEMPTS and
 * throw — which the driver would then treat as a batch failure and re-OCR
 * pages that had already succeeded.
 *
 * So writes funnel through one promise chain (never concurrent, therefore
 * never a CAS conflict) and are batched: a flush happens once enough pages
 * have accumulated or enough time has passed. The extraction lease already
 * guarantees only one job per document runs at a time, so an in-process chain
 * is sufficient to make conflicts impossible rather than merely rare.
 */
export class PageWriteBuffer {
  private view: DocumentPagesFile | null;
  private bufferedPages: PageEntry[] = [];
  private bufferedFailed: number[] = [];
  /** Pages recorded but not yet flushed — already done, must not be re-issued. */
  private readonly settled = new Set<number>();
  private lastFlushAt = Date.now();
  private chain: Promise<void> = Promise.resolve();

  constructor(
    private readonly store: DocumentPagesStore,
    private readonly userId: string,
    private readonly documentId: string,
    private readonly pageCount: number,
    private readonly maxPageAttempts: number,
    known: DocumentPagesFile | null,
    private readonly options: PageWriteBufferOptions
  ) {
    this.view = known;
  }

  /** Latest persisted view. Only authoritative straight after `flush()`. */
  get snapshot(): DocumentPagesFile | null {
    return this.view;
  }

  /**
   * Pages still needing OCR, accounting for work buffered but not yet written.
   * Without the `settled` filter a retry pass could re-dispatch a page whose
   * result is sitting in the buffer.
   */
  pending(): number[] {
    return pagesNeedingWork(this.view, this.pageCount, this.maxPageAttempts).filter(
      (page) => !this.settled.has(page)
    );
  }

  async recordExtracted(entries: readonly PageEntry[]): Promise<void> {
    for (const entry of entries) {
      this.bufferedPages.push(entry);
      this.settled.add(entry.pageNumber);
    }
    await this.maybeFlush();
  }

  async recordFailed(pages: readonly number[]): Promise<void> {
    for (const page of pages) {
      this.bufferedFailed.push(page);
      this.settled.add(page);
    }
    await this.maybeFlush();
  }

  private async maybeFlush(): Promise<void> {
    const buffered = this.bufferedPages.length + this.bufferedFailed.length;
    const due =
      buffered >= this.options.flushEveryPages ||
      Date.now() - this.lastFlushAt >= this.options.flushEveryMs;
    if (due) await this.flush();
  }

  /** Writes everything buffered. Safe to call concurrently — writes serialise. */
  async flush(): Promise<DocumentPagesFile | null> {
    const next = this.chain.catch(() => undefined).then(() => this.flushOnce());
    this.chain = next.catch(() => undefined);
    await next;
    return this.view;
  }

  private async flushOnce(): Promise<void> {
    const entries = this.bufferedPages;
    const failed = this.bufferedFailed;
    if (entries.length === 0 && failed.length === 0) return;

    this.bufferedPages = [];
    this.bufferedFailed = [];
    this.lastFlushAt = Date.now();

    try {
      this.view = await this.store.mergePages(this.userId, this.documentId, entries, {
        pageCount: this.pageCount,
        failedPages: failed
      });
      // Everything in this write is now reflected in `view`; the overlay that
      // kept it from being re-issued is no longer needed.
      for (const entry of entries) this.settled.delete(entry.pageNumber);
      for (const page of failed) this.settled.delete(page);
    } catch (error) {
      // Put the work back so the next flush (or the final one) retries it
      // rather than silently dropping OCR results we already paid for.
      this.bufferedPages = entries.concat(this.bufferedPages);
      this.bufferedFailed = failed.concat(this.bufferedFailed);
      throw error;
    }
  }
}
