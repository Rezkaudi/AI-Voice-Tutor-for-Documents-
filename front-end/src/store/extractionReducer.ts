import type { ExtractionState, PageExtractionStreamEvent } from "@/types";

const INITIAL_STATE: ExtractionState = {
  status: "connecting",
  pageCount: 0,
  extractedPages: [],
  failedPages: [],
  currentPage: null,
  currentPages: [],
  done: false
};

export function reduceExtraction(
  current: ExtractionState | undefined,
  event: PageExtractionStreamEvent
): ExtractionState {
  const state = current ?? INITIAL_STATE;

  switch (event.event) {
    case "progress": {
      const extractedPages = sortedUnique([...state.extractedPages, ...event.data.extracted]);
      const failedPages = sortedUnique([...state.failedPages, ...event.data.failed]);
      const activePages = event.data.extracting ?? activePagesOf(state);
      const currentPages = sortedUnique(activePages).filter(
        (page) => !extractedPages.includes(page) && !failedPages.includes(page)
      );
      return {
        ...state,
        status: event.data.done ? "done" : "extracting",
        pageCount: event.data.pageCount || state.pageCount,
        extractedPages,
        failedPages,
        currentPage: currentPages[0] ?? null,
        currentPages,
        done: event.data.done || state.done
      };
    }
    case "page-start":
      return {
        ...state,
        status: "extracting",
        currentPage: event.data.page,
        currentPages: sortedUnique([...activePagesOf(state), event.data.page])
      };
    case "page-ready": {
      const currentPages = activePagesOf(state).filter((page) => page !== event.data.page);
      return {
        ...state,
        status: "extracting",
        extractedPages: sortedUnique([...state.extractedPages, event.data.page]),
        failedPages: state.failedPages.filter((page) => page !== event.data.page),
        currentPage: state.currentPage === event.data.page ? currentPages[0] ?? null : state.currentPage,
        currentPages
      };
    }
    case "page-failed": {
      const currentPages = activePagesOf(state).filter((page) => page !== event.data.page);
      return {
        ...state,
        // A page that already succeeded is never demoted to failed.
        failedPages: state.extractedPages.includes(event.data.page)
          ? state.failedPages
          : sortedUnique([...state.failedPages, event.data.page]),
        currentPage: state.currentPage === event.data.page ? currentPages[0] ?? null : state.currentPage,
        currentPages
      };
    }
    case "done":
      return { ...state, status: "done", done: true, currentPage: null, currentPages: [] };
    case "error":
      return { ...state, status: "error", currentPage: null, currentPages: [] };
    default:
      return state;
  }
}

/** Pages currently being extracted, falling back to the single-page field. */
function activePagesOf(state: ExtractionState): number[] {
  const currentPages = state.currentPages ?? [];
  return currentPages.length > 0
    ? currentPages
    : state.currentPage !== null
      ? [state.currentPage]
      : [];
}

function sortedUnique(pages: number[]): number[] {
  return Array.from(new Set(pages)).sort((a, b) => a - b);
}
