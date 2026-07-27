import type { DocumentPagesStore } from "@/application/services/document-pages-store";
import type { ExtractionRegistry } from "@/application/services/extraction-registry";
import type { PageExtractionDriver } from "@/application/services/page-extraction-driver";
import {
  abortableSleep,
  type PageExtractionSession
} from "@/application/services/page-extraction-session";
import type { DocumentPagesFile } from "@/domain/entities/document-pages";
import { extractedPages } from "@/domain/entities/document-pages";

const WATCH_INTERVAL_MS = 2_000;

export class PageExtractionWatcher {
  constructor(
    private readonly pagesStore: DocumentPagesStore,
    private readonly registry: ExtractionRegistry,
    private readonly driver: PageExtractionDriver
  ) { }

  async follow(session: PageExtractionSession, known: DocumentPagesFile | null): Promise<void> {
    const { userId, documentId, signal, queue, log } = session;
    log.info(`document ${documentId} · another stream is driving · watching pages.json`);
    let seenPages = new Set(extractedPages(known));
    let seenFailed = new Set(known?.failed ?? []);
    const seenStarted = new Set(this.registry.activePages(documentId));

    while (!signal.aborted) {
      await abortableSleep(WATCH_INTERVAL_MS, signal);
      if (signal.aborted) return;

      if (this.registry.acquire(documentId)) {
        try {
          const latest = (await this.pagesStore.read(userId, documentId))?.file ?? null;
          await this.driver.drive(session, latest);
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
}
