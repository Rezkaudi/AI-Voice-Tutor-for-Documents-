import { randomUUID } from "node:crypto";

import type { PageExtractionEvent } from "@/application/dto/page-extraction-event";
import type { DocumentPagesStore } from "@/application/services/document-pages-store";
import type { ExtractionLease } from "@/application/services/extraction-lease";
import type { PageExtractionDriver } from "@/application/services/page-extraction-driver";
import { SinkEventQueue } from "@/application/services/sink-event-queue";
import type { DocumentPagesFile } from "@/domain/entities/document-pages";
import { pagesNeedingWork } from "@/domain/entities/document-pages";
import type { DocumentRepository } from "@/domain/repositories/document-repository";
import type { ExtractionQueue } from "@/domain/services/extraction-queue";
import type { Logger } from "@/domain/services/logger";

export interface RunExtractionJobInput {
  readonly userId: string;
  readonly documentId: string;
}

export type RunExtractionJobStatus =
  | "done"
  | "busy"
  | "continued"
  | "missing"
  | "failed";

export interface RunExtractionJobResult {
  readonly status: RunExtractionJobStatus;
  readonly remaining: number;
}

export class RunExtractionJobUseCase {
  private readonly instanceId = process.env.K_REVISION || randomUUID().slice(0, 8);

  constructor(
    private readonly repository: DocumentRepository,
    private readonly pagesStore: DocumentPagesStore,
    private readonly lease: ExtractionLease,
    private readonly driver: PageExtractionDriver,
    private readonly queue: ExtractionQueue,
    private readonly logger: Logger,
    private readonly budgetMs: number,
    private readonly maxPageAttempts: number,
    private readonly leaseHeartbeatMs: number
  ) { }

  async execute(input: RunExtractionJobInput): Promise<RunExtractionJobResult> {
    const log = this.logger.scope("extraction-job");
    const { userId, documentId } = input;

    const document = await this.repository.findById(documentId, userId);
    if (!document) {
      log.warn(`document ${documentId} · no longer exists · dropping job`);
      return { status: "missing", remaining: 0 };
    }

    const before = await this.readPages(userId, documentId);
    const pendingBefore = this.remaining(before, document.pageCount);
    if (pendingBefore === 0) {
      return { status: "done", remaining: 0 };
    }

    const owner = `${this.instanceId}:${randomUUID().slice(0, 8)}`;
    const handle = await this.lease.acquire(userId, documentId, owner);
    if (!handle) {
      log.info(`document ${documentId} · another worker holds the lease · skipping`);
      return { status: "busy", remaining: pendingBefore };
    }

    log.info(
      `document ${documentId} · extracting in background · ${pendingBefore} page(s) pending`
    );

    const controller = new AbortController();
    let budgetExpired = false;
    const budget = setTimeout(() => {
      budgetExpired = true;
      controller.abort();
    }, this.budgetMs);

    const heartbeat = setInterval(() => {
      void handle
        .renew()
        .then((held) => {
          if (!held) {
            log.warn(`document ${documentId} · lease lost · stopping`);
            controller.abort();
          }
        })
        .catch(() => undefined);
    }, this.leaseHeartbeatMs);

    let failure: unknown = null;

    try {
      await this.driver.drive(
        {
          userId,
          documentId,
          storagePath: document.storagePath,
          pageCount: document.pageCount,
          signal: controller.signal,
          queue: new SinkEventQueue<PageExtractionEvent>(),
          log,
          reportActive: async (pages: number[]): Promise<boolean> => {
            const held = await handle.renew(pages);
            if (!held) {
              log.warn(`document ${documentId} · lease lost mid-job · stopping`);
              controller.abort();
            }
            return held;
          }
        },
        before
      );
    } catch (error) {
      failure = error;
      log.error(`document ${documentId} · extraction job errored`, error);
    } finally {
      clearTimeout(budget);
      clearInterval(heartbeat);
      await handle.release().catch(() => undefined);
    }

    const after = await this.readPages(userId, documentId);
    const pendingAfter = this.remaining(after, document.pageCount);

    if (pendingAfter === 0) {
      log.info(`document ${documentId} · extraction complete`);
      return { status: "done", remaining: 0 };
    }

    if (pendingAfter >= pendingBefore && !budgetExpired) {
      log.warn(
        `document ${documentId} · no progress this pass · deferring to queue retry`,
        failure ?? undefined
      );
      return { status: "failed", remaining: pendingAfter };
    }

    log.info(`document ${documentId} · ${pendingAfter} page(s) left · queueing continuation`);
    await this.queue.enqueue({ userId, documentId });
    return { status: "continued", remaining: pendingAfter };
  }

  private async readPages(userId: string, documentId: string): Promise<DocumentPagesFile | null> {
    return (await this.pagesStore.read(userId, documentId))?.file ?? null;
  }

  private remaining(file: DocumentPagesFile | null, pageCount: number): number {
    return pagesNeedingWork(file, pageCount, this.maxPageAttempts).length;
  }
}
