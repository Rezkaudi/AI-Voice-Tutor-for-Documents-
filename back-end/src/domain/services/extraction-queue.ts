export interface ExtractionJob {
  readonly userId: string;
  readonly documentId: string;
}

export interface EnqueueOptions {
  readonly delaySeconds?: number;
  readonly dedupeKey?: string;
}

export interface ExtractionQueue {
  enqueue(job: ExtractionJob, options?: EnqueueOptions): Promise<void>;
}
