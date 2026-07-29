import type { DocumentPagesStore } from "@/application/services/document-pages-store";
import type { ExtractionLease } from "@/application/services/extraction-lease";
import {
  abortableSleep,
  type PageExtractionSession
} from "@/application/services/page-extraction-session";
import type { DocumentPagesFile } from "@/domain/entities/document-pages";
import { extractedPages, pagesNeedingWork } from "@/domain/entities/document-pages";
import type { ExtractionQueue } from "@/domain/services/extraction-queue";

const WATCH_INTERVAL_MS = 2_000;
const REQUEUE_INTERVAL_MS = 30_000;

export class PageExtractionWatcher {
  constructor(
    private readonly pagesStore: DocumentPagesStore,
    private readonly lease: ExtractionLease,
    private readonly queue: ExtractionQueue,
    private readonly maxPageAttempts: number
  ) { }

  async follow(session: PageExtractionSession, known: DocumentPagesFile | null): Promise<void> {
    const { userId, documentId, pageCount, signal, queue: events, log } = session;
    let seenPages = new Set(extractedPages(known));
    let seenFailed = new Set(known?.failed ?? []);
    const seenStarted = new Set<number>();
    let lastEnqueueAt = Date.now();

    while (!signal.aborted) {
      await abortableSleep(WATCH_INTERVAL_MS, signal);
      if (signal.aborted) return;

      const active = await this.lease.activePages(userId, documentId);
      for (const page of active) {
        if (!seenStarted.has(page)) {
          events.push({ event: "page-start", data: { page } });
          seenStarted.add(page);
        }
      }

      const latest = (await this.pagesStore.read(userId, documentId))?.file ?? null;
      for (const page of extractedPages(latest)) {
        if (!seenPages.has(page)) {
          events.push({ event: "page-ready", data: { page } });
        }
      }
      for (const page of latest?.failed ?? []) {
        if (!seenFailed.has(page)) {
          events.push({ event: "page-failed", data: { page } });
        }
      }
      seenPages = new Set(extractedPages(latest));
      seenFailed = new Set(latest?.failed ?? []);

      if (pagesNeedingWork(latest, pageCount, this.maxPageAttempts).length === 0) {
        events.push({ event: "done", data: {} });
        return;
      }

      if (active.length === 0 && Date.now() - lastEnqueueAt >= REQUEUE_INTERVAL_MS) {
        lastEnqueueAt = Date.now();
        try {
          await this.queue.enqueue({ userId, documentId });
        } catch (error) {
          log.warn(`document ${documentId} · could not re-queue extraction`, error);
        }
      }
    }
  }
}
