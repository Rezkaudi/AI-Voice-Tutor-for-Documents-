import { create } from "zustand";
import {
  deleteDocument as deleteDocumentRequest,
  fetchDocument,
  listDocuments,
  uploadDocument
} from "@/services/documentsApi";
import { useSessionStore } from "./sessionStore";
import type {
  DocumentCitation,
  DocumentPage,
  DocumentReference,
  DocumentSummary,
  LoadedDocument,
  UploadState
} from "@/lib/types";

const LAST_DOC_KEY = "lastDocumentId";

interface DocumentStore {
  loadedDocument: LoadedDocument | null;
  uploadState: UploadState;
  activePage: number;
  highlight: DocumentReference | null;
  /** Stable key of the citation currently highlighted in the viewer. */
  activeCitationKey: string | null;
  library: DocumentSummary[];
  libraryLoading: boolean;
  deletingId: string | null;
  /** Upload-specific failure, surfaced in the upload panel/library — not the document view. */
  uploadError: string | null;
  setActivePage: (activePage: number) => void;
  setUploadError: (uploadError: string | null) => void;
  applyReference: (reference: DocumentReference | null) => void;
  focusCitation: (citation: DocumentCitation) => void;
  uploadFile: (file: File | null) => Promise<void>;
  loadLibrary: () => Promise<void>;
  selectDocument: (documentId: string) => Promise<void>;
  deleteDocument: (documentId: string) => Promise<void>;
  initLibrary: () => Promise<void>;
}

/**
 * Document store: upload + processing, the active page, the teacher's
 * page-reference highlight, and the library of previously processed documents
 * the learner can switch between.
 */
export const useDocumentStore = create<DocumentStore>((set, get) => ({
  loadedDocument: null,
  uploadState: "idle",
  activePage: 1,
  highlight: null,
  activeCitationKey: null,
  library: [],
  libraryLoading: false,
  deletingId: null,
  uploadError: null,

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

  /** Loads an existing document (no re-upload) and remembers it as current. */
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
        activePage: data.pages[0]?.pageNumber ?? 1
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

  /** Uploads a file, waits for processing, then loads the document. */
  uploadFile: async (file) => {
    if (!file) {
      return;
    }

    set({ uploadState: "processing", highlight: null, activeCitationKey: null, uploadError: null });
    useSessionStore.getState().setError(null);

    try {
      const { documentId } = await uploadDocument(file);
      const data = await fetchDocument(documentId);
      set({ loadedDocument: data, activePage: data.pages[0]?.pageNumber ?? 1 });
      window.localStorage.setItem(LAST_DOC_KEY, documentId);
      void get().loadLibrary();
    } catch (error) {
      set({ uploadError: error instanceof Error ? error.message : "Upload failed." });
    } finally {
      set({ uploadState: "idle" });
    }
  },

  /** Deletes a document from the server and prunes it from local state. */
  deleteDocument: async (documentId) => {
    if (get().deletingId) return;
    set({ deletingId: documentId });
    useSessionStore.getState().setError(null);
    try {
      await deleteDocumentRequest(documentId);
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

  /** On app start: just load the library. The user picks which document to open. */
  initLibrary: async () => {
    await get().loadLibrary();
  }
}));

/** Stable identifier for one citation across its lifetime. */
export function citationKey(citation: DocumentCitation): string {
  return `${citation.pageNumber}:${citation.start}:${citation.end}`;
}

/** Derives the page object for the active page number. */
export function selectCurrentPage(state: DocumentStore): DocumentPage | null {
  const { loadedDocument, activePage } = state;
  if (!loadedDocument) {
    return null;
  }
  return (
    loadedDocument.pages.find((page) => page.pageNumber === activePage) ??
    loadedDocument.pages[0] ??
    null
  );
}
