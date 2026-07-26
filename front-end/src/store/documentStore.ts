import { create } from "zustand";
import { deleteDocument as deleteDocumentRequest, fetchDocument, listDocuments, uploadDocument } from "@/services/documentsApi";
import { toErrorMessage } from "@/lib/errors";
import { useSessionStore } from "./sessionStore";
import { reduceExtraction } from "./extractionReducer";
import { startExtractionWatch, stopExtractionWatch } from "./extractionStreamRunner";
import type { DocumentCitation, DocumentReference, DocumentSummary, ExtractionState, LoadedDocument, PageExtractionStreamEvent, UploadState } from "@/types";

const CLOSED_DOCUMENT_STATE = {
  loadedDocument: null,
  highlight: null,
  activePage: 1,
  activeCitationKey: null
} as const;

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
  refreshFileUrl: () => Promise<void>;
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
      activeCitationKey: firstCitation ? citationKey(firstCitation) : null,
      ...(reference ? { activePage: reference.pageNumber } : null)
    });
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
      useSessionStore.getState().setError(toErrorMessage(error, "Library failed to load."));
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
    get().clearExtraction(documentId);
    try {
      const data = await fetchDocument(documentId);
      set({
        loadedDocument: data,
        activePage: 1
      });
    } catch (error) {
      useSessionStore.getState().setError(toErrorMessage(error, "Document failed to load."));
    } finally {
      set({ uploadState: "idle" });
    }
  },

  refreshFileUrl: async () => {
    const current = get().loadedDocument;
    if (!current) return;
    try {
      const data = await fetchDocument(current.document.id);
      if (get().loadedDocument?.document.id !== current.document.id) return;
      set({ loadedDocument: data });
    } catch {
      // Leave the existing error on screen — the viewer already reported it.
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
      void get().loadLibrary();
      startExtractionWatch(documentId);
      return documentId;
    } catch (error) {
      set({ uploadError: toErrorMessage(error, "Upload failed.") });
      return null;
    } finally {
      set({ uploadState: "idle", uploadProgress: 0, uploadPhase: "uploading" });
    }
  },

  closeDocument: () => {
    const documentId = get().loadedDocument?.document.id;
    if (documentId) {
      stopExtractionWatch(documentId);
      get().clearExtraction(documentId);
    }
    set({ ...CLOSED_DOCUMENT_STATE });
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
      if (get().loadedDocument?.document.id === documentId) {
        set({ ...CLOSED_DOCUMENT_STATE });
      }
    } catch (error) {
      useSessionStore.getState().setError(toErrorMessage(error, "Delete failed."));
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

