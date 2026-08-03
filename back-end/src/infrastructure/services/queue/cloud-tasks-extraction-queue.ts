import { GoogleAuth } from "google-auth-library";

import type { EnvConfig } from "@/config/env.config";
import type {
  EnqueueOptions,
  ExtractionJob,
  ExtractionQueue
} from "@/domain/services/extraction-queue";
import type { Logger } from "@/domain/services/logger";

const TASKS_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

export class CloudTasksExtractionQueue implements ExtractionQueue {
  private readonly auth = new GoogleAuth({ scopes: TASKS_SCOPE });

  constructor(
    private readonly config: EnvConfig,
    private readonly logger: Logger
  ) { }

  async enqueue(job: ExtractionJob, options?: EnqueueOptions): Promise<void> {
    const parent =
      `projects/${this.config.GCP_PROJECT_ID}` +
      `/locations/${this.config.GCP_TASKS_LOCATION}` +
      `/queues/${this.config.GCP_TASKS_QUEUE}`;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.config.EXTRACTION_WORKER_TOKEN) {
      headers["X-Extraction-Token"] = this.config.EXTRACTION_WORKER_TOKEN;
    }
    const task: Record<string, unknown> = {
      httpRequest: {
        url: `${this.config.EXTRACTION_WORKER_URL}/internal/extraction/run`,
        httpMethod: "POST",
        headers,
        body: Buffer.from(JSON.stringify(job), "utf8").toString("base64")
      }
    };

    if (options?.delaySeconds) {
      task.scheduleTime = new Date(Date.now() + options.delaySeconds * 1000).toISOString();
    }
    if (options?.dedupeKey) {
      task.name = `${parent}/tasks/${sanitizeTaskId(options.dedupeKey)}`;
    }

    try {
      const client = await this.auth.getClient();
      await client.request({
        url: `https://cloudtasks.googleapis.com/v2/${parent}/tasks`,
        method: "POST",
        data: { task }
      });
    } catch (error) {
      if (isAlreadyExists(error)) {
        this.logger
          .scope("extraction-queue")
          .info(`document ${job.documentId} · job already queued · skipping duplicate`);
        return;
      }
      throw error;
    }
  }
}

function sanitizeTaskId(key: string): string {
  return key.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 500);
}

function isAlreadyExists(error: unknown): boolean {
  const status = (error as { response?: { status?: number }; code?: number })?.response?.status
    ?? (error as { code?: number })?.code;
  return status === 409;
}
