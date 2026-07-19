import { create } from "zustand";
import {
  deleteDocument as deleteDocumentRequest,
  fetchDocument,
  listDocuments,
  uploadDocument
} from "@/services/documentsApi";
import { useSessionStore } from "./sessionStore";
import {
  startExtractionWatch,
  stopExtractionWatch
} from "./extractionStreamRunner";
import type {
  DocumentCitation,
  DocumentReference,
  DocumentSummary,
  ExtractionState,
  LoadedDocument,
  PageExtractionStreamEvent,
  UploadState
} from "@/types";

const LAST_DOC_KEY = "lastDocumentId";

interface DocumentStore {
  loadedDocument: LoadedDocument | null;
  uploadState: UploadState;
  uploadProgress: number;
  uploadPhase: "uploading" | "processing";
  activePage: number;
  highlight: DocumentReference | null;

  activeCitationKey: string | null;
  library: DocumentSummary[];
  libraryLoading: boolean;
  deletingId: string | null;

  uploadError: string | null;
  extraction: Record<string, ExtractionState>;
  applyExtractionEvent: (documentId: string, event: PageExtractionStreamEvent) => void;
  clearExtraction: (documentId: string) => void;
  setActivePage: (activePage: number) => void;
  setUploadError: (uploadError: string | null) => void;
  applyReference: (reference: DocumentReference | null) => void;
  focusCitation: (citation: DocumentCitation) => void;
  uploadFile: (file: File | null) => Promise<string | null>;
  closeDocument: () => void;
  loadLibrary: () => Promise<void>;
  selectDocument: (documentId: string) => Promise<void>;
  deleteDocument: (documentId: string) => Promise<void>;
  initLibrary: () => Promise<void>;
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  loadedDocument: null,
  uploadState: "idle",
  uploadProgress: 0,
  uploadPhase: "uploading",
  activePage: 1,
  highlight: null,
  activeCitationKey: null,
  library: [],
  libraryLoading: false,
  deletingId: null,
  uploadError: null,
  extraction: {},

  applyExtractionEvent: (documentId, event) =>
    set((state) => ({
      extraction: {
        ...state.extraction,
        [documentId]: reduceExtraction(state.extraction[documentId], event)
      }
    })),

  clearExtraction: (documentId) =>
    set((state) => {
      const extraction = { ...state.extraction };
      delete extraction[documentId];
      return { extraction };
    }),

  setActivePage: (activePage) => set({ activePage, activeCitationKey: null }),

  setUploadError: (uploadError) => set({ uploadError }),

  applyReference: (reference) => {
    const firstCitation = reference?.citations[0] ?? null;
    set({
      highlight: reference,
      activeCitationKey: firstCitation ? citationKey(firstCitation) : null
    });
    if (reference) {
      set({ activePage: reference.pageNumber });
    }
  },

  focusCitation: (citation) => {
    set({
      activePage: citation.pageNumber,
      activeCitationKey: citationKey(citation)
    });
  },

  loadLibrary: async () => {
    set({ libraryLoading: true });
    try {
      const documents = await listDocuments();
      set({ library: documents });
    } catch (error) {
      useSessionStore
        .getState()
        .setError(error instanceof Error ? error.message : "Library failed to load.");
    } finally {
      set({ libraryLoading: false });
    }
  },

  selectDocument: async (documentId) => {
    if (get().loadedDocument?.document.id === documentId) {
      return;
    }
    set({ uploadState: "processing", highlight: null, activeCitationKey: null });
    useSessionStore.getState().setError(null);
    try {
      const data = await fetchDocument(documentId);
      set({
        loadedDocument: data,
        activePage: 1
      });
      window.localStorage.setItem(LAST_DOC_KEY, documentId);
    } catch (error) {
      useSessionStore
        .getState()
        .setError(error instanceof Error ? error.message : "Document failed to load.");
    } finally {
      set({ uploadState: "idle" });
    }
  },

  uploadFile: async (file) => {
    if (!file) {
      return null;
    }

    set({
      uploadState: "processing",
      uploadProgress: 0,
      uploadPhase: "uploading",
      highlight: null,
      activeCitationKey: null,
      uploadError: null
    });
    useSessionStore.getState().setError(null);

    try {
      // Real byte-transfer progress from the direct-to-S3 upload — no simulation.
      const { documentId } = await uploadDocument(file, (percent) => {
        set({ uploadProgress: percent });
      });

      // Bytes are in S3; the remaining register + page fetch have no measurable
      // progress, so we show the spinner instead of a stalled bar.
      set({ uploadPhase: "processing", uploadProgress: 100 });

      const data = await fetchDocument(documentId);
      set({ loadedDocument: data, activePage: 1 });
      window.localStorage.setItem(LAST_DOC_KEY, documentId);
      void get().loadLibrary();
      startExtractionWatch(documentId);
      return documentId;
    } catch (error) {
      set({ uploadError: error instanceof Error ? error.message : "Upload failed." });
      return null;
    } finally {
      set({ uploadState: "idle", uploadProgress: 0, uploadPhase: "uploading" });
    }
  },

  closeDocument: () => {
    const documentId = get().loadedDocument?.document.id;
    if (documentId) stopExtractionWatch(documentId);
    set({
      loadedDocument: null,
      highlight: null,
      activePage: 1,
      activeCitationKey: null
    });
  },

  deleteDocument: async (documentId) => {
    if (get().deletingId) return;
    set({ deletingId: documentId });
    useSessionStore.getState().setError(null);
    try {
      await deleteDocumentRequest(documentId);
      stopExtractionWatch(documentId);
      get().clearExtraction(documentId);
      set((state) => ({
        library: state.library.filter((doc) => doc.id !== documentId)
      }));
      if (window.localStorage.getItem(LAST_DOC_KEY) === documentId) {
        window.localStorage.removeItem(LAST_DOC_KEY);
      }
      if (get().loadedDocument?.document.id === documentId) {
        set({
          loadedDocument: null,
          highlight: null,
          activePage: 1,
          activeCitationKey: null
        });
      }
    } catch (error) {
      useSessionStore
        .getState()
        .setError(error instanceof Error ? error.message : "Delete failed.");
    } finally {
      set({ deletingId: null });
    }
  },

  initLibrary: async () => {
    await get().loadLibrary();
  }
}));

export function citationKey(citation: DocumentCitation): string {
  return `${citation.pageNumber}:${citation.start}:${citation.end}`;
}

function reduceExtraction(
  current: ExtractionState | undefined,
  event: PageExtractionStreamEvent
): ExtractionState {
  const state: ExtractionState = current ?? {
    status: "connecting",
    pageCount: 0,
    extractedPages: [],
    failedPages: [],
    currentPage: null,
    done: false
  };

  switch (event.event) {
    case "progress":
      return {
        ...state,
        status: event.data.done ? "done" : "extracting",
        pageCount: event.data.pageCount || state.pageCount,
        extractedPages: sortedUnique([...state.extractedPages, ...event.data.extracted]),
        failedPages: sortedUnique([...state.failedPages, ...event.data.failed]),
        done: event.data.done || state.done
      };
    case "page-start":
      return { ...state, status: "extracting", currentPage: event.data.page };
    case "page-ready":
      return {
        ...state,
        status: "extracting",
        extractedPages: sortedUnique([...state.extractedPages, event.data.page]),
        failedPages: state.failedPages.filter((page) => page !== event.data.page),
        currentPage: state.currentPage === event.data.page ? null : state.currentPage
      };
    case "page-failed":
      return {
        ...state,
        failedPages: state.extractedPages.includes(event.data.page)
          ? state.failedPages
          : sortedUnique([...state.failedPages, event.data.page]),
        currentPage: state.currentPage === event.data.page ? null : state.currentPage
      };
    case "done":
      return { ...state, status: "done", done: true, currentPage: null };
    case "error":
      return { ...state, status: "error", currentPage: null };
    default:
      return state;
  }
}

function sortedUnique(pages: number[]): number[] {
  return Array.from(new Set(pages)).sort((a, b) => a - b);
}
