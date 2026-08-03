import type { DocumentPagesStore, PageEntry } from "@/application/services/document-pages-store";
import type { DocumentPagesFile } from "@/domain/entities/document-pages";
import { pagesNeedingWork } from "@/domain/entities/document-pages";

export interface PageWriteBufferOptions {
  readonly flushEveryPages: number;
  readonly flushEveryMs: number;
}

export class PageWriteBuffer {
  private view: DocumentPagesFile | null;
  private bufferedPages: PageEntry[] = [];
  private bufferedFailed: number[] = [];
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

  get snapshot(): DocumentPagesFile | null {
    return this.view;
  }

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
      for (const entry of entries) this.settled.delete(entry.pageNumber);
      for (const page of failed) this.settled.delete(page);
    } catch (error) {
      this.bufferedPages = entries.concat(this.bufferedPages);
      this.bufferedFailed = failed.concat(this.bufferedFailed);
      throw error;
    }
  }
}
