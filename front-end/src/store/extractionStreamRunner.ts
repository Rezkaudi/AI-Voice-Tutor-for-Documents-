import { readEventStream } from "@/lib/sse";
import { openExtractionStream } from "@/services/documentsApi";
import { useDocumentStore } from "@/store/documentStore";
import type { PageExtractionStreamEvent } from "@/types";

const activeRuns = new Map<string, AbortController>();

const MAX_BACKOFF_MS = 15_000;

export function isExtractionWatchActive(documentId: string): boolean {
  return activeRuns.has(documentId);
}

export function stopExtractionWatch(documentId: string): void {
  const controller = activeRuns.get(documentId);
  if (!controller) return;
  activeRuns.delete(documentId);
  controller.abort();
}

export function startExtractionWatch(documentId: string): void {
  if (!documentId || activeRuns.has(documentId)) return;
  if (useDocumentStore.getState().extraction[documentId]?.done) return;

  const controller = new AbortController();
  activeRuns.set(documentId, controller);
  void run(documentId, controller.signal).finally(() => {
    if (activeRuns.get(documentId) === controller) {
      activeRuns.delete(documentId);
    }
  });
}

async function run(documentId: string, signal: AbortSignal): Promise<void> {
  let attempt = 0;
  while (!signal.aborted) {
    try {
      const body = await openExtractionStream(documentId, signal);
      await readEventStream<PageExtractionStreamEvent>(body, (event) => {
        if (event.event === "ping") return;
        if (event.event === "progress" || event.event === "page-ready") {
          attempt = 0;
        }
        useDocumentStore.getState().applyExtractionEvent(documentId, event);
      });
    } catch {
      // Connection failed or dropped — fall through to the retry delay.
    }

    if (signal.aborted || useDocumentStore.getState().extraction[documentId]?.done) {
      return;
    }
    await sleep(Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS), signal);
    attempt += 1;
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
