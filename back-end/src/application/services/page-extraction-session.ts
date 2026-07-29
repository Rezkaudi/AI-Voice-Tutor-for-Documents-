import type { PageExtractionEvent } from "@/application/dto/page-extraction-event";
import type { AsyncEventQueue } from "@/application/services/async-event-queue";
import type { Logger } from "@/domain/services/logger";

export interface PageExtractionSession {
  readonly userId: string;
  readonly documentId: string;
  readonly storagePath: string;
  readonly pageCount: number;
  readonly signal: AbortSignal;
  readonly queue: AsyncEventQueue<PageExtractionEvent>;
  readonly log: Logger;
  readonly reportActive?: (pages: number[]) => Promise<boolean>;
}

export function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      resolve();
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
