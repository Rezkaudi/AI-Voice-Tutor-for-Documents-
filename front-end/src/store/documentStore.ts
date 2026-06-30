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
} from "@/types";

const LAST_DOC_KEY = "lastDocumentId";

interface DocumentStore {
  loadedDocument: LoadedDocument | null;
  uploadState: UploadState;
  activePage: number;
  highlight: DocumentReference | null;

  activeCitationKey: string | null;
  library: DocumentSummary[];
  libraryLoading: boolean;
  deletingId: string | null;

  uploadError: string | null;
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

  uploadFile: async (file) => {
    if (!file) {
      return null;
    }

    set({ uploadState: "processing", highlight: null, activeCitationKey: null, uploadError: null });
    useSessionStore.getState().setError(null);

    try {
      const { documentId } = await uploadDocument(file);
      const data = await fetchDocument(documentId);
      set({ loadedDocument: data, activePage: data.pages[0]?.pageNumber ?? 1 });
      window.localStorage.setItem(LAST_DOC_KEY, documentId);
      void get().loadLibrary();
      return documentId;
    } catch (error) {
      set({ uploadError: error instanceof Error ? error.message : "Upload failed." });
      return null;
    } finally {
      set({ uploadState: "idle" });
    }
  },

  closeDocument: () =>
    set({
      loadedDocument: null,
      highlight: null,
      activePage: 1,
      activeCitationKey: null
    }),

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

  initLibrary: async () => {
    await get().loadLibrary();
  }
}));

export function citationKey(citation: DocumentCitation): string {
  return `${citation.pageNumber}:${citation.start}:${citation.end}`;
}

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
