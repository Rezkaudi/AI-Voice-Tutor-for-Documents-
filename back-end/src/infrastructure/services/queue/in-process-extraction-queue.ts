import type {
  EnqueueOptions,
  ExtractionJob,
  ExtractionQueue
} from "@/domain/services/extraction-queue";
import type { Logger } from "@/domain/services/logger";

export type ExtractionJobRunner = (job: ExtractionJob) => Promise<unknown>;

export class InProcessExtractionQueue implements ExtractionQueue {
  private runner: ExtractionJobRunner | null = null;
  private readonly pending = new Set<string>();

  constructor(private readonly logger: Logger) { }

  setRunner(runner: ExtractionJobRunner): void {
    this.runner = runner;
  }

  async enqueue(job: ExtractionJob, options?: EnqueueOptions): Promise<void> {
    const log = this.logger.scope("extraction-queue");
    if (!this.runner) {
      log.warn(`document ${job.documentId} · no job runner wired · dropping job`);
      return;
    }

    const key = options?.dedupeKey ?? `${job.userId}:${job.documentId}`;
    if (this.pending.has(key)) return;
    this.pending.add(key);

    const timer = setTimeout(() => {
      this.pending.delete(key);
      void this.runner?.(job).catch((error: unknown) => {
        log.error(`document ${job.documentId} · background extraction failed`, error);
      });
    }, (options?.delaySeconds ?? 0) * 1000);

    timer.unref?.();
  }
}
