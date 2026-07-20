import { MAX_LESSON_PAGES } from "@/lib/constants";
import type { ExtractionState } from "@/types";

export type PageStatus = "ready" | "extracting" | "pending" | "failed";

export function normalizePageSelection(pages: number[], pageCount: number): number[] {
  return Array.from(new Set(pages))
    .filter((page) => page >= 1 && page <= pageCount)
    .sort((a, b) => a - b)
    .slice(0, MAX_LESSON_PAGES);
}

export function pageStatus(
  page: number,
  extraction: ExtractionState | undefined
): PageStatus {
  if (!extraction) return "ready";
  if (extraction.extractedPages.includes(page)) return "ready";
  if (extraction.failedPages.includes(page)) return "failed";
  if (extraction.done) return "failed";
  if ((extraction.currentPages ?? []).includes(page) || extraction.currentPage === page) {
    return "extracting";
  }
  return "pending";
}
