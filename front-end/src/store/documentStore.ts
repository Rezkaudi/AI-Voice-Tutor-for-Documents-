import { create } from "zustand";
import { fetchDocument, uploadDocument } from "@/services/documentsApi";
import { useSessionStore } from "./sessionStore";
import type {
  DocumentPage,
  DocumentReference,
  LoadedDocument,
  UploadState
} from "@/lib/types";

interface DocumentStore {
  loadedDocument: LoadedDocument | null;
  uploadState: UploadState;
  activePage: number;
  highlight: DocumentReference | null;
  setActivePage: (activePage: number) => void;
  applyReference: (reference: DocumentReference | null) => void;
  uploadFile: (file: File | null) => Promise<void>;
}

/**
 * Document store: upload + processing, the active page, and the teacher's
 * page-reference highlight.
 *
 * `uploadState` values: "idle" | "processing".
 */
export const useDocumentStore = create<DocumentStore>((set) => ({
  loadedDocument: null,
  uploadState: "idle",
  activePage: 1,
  highlight: null,

  setActivePage: (activePage) => set({ activePage }),

  /** Mirrors a teacher page reference: highlight it and jump to its page. */
  applyReference: (reference) => {
    set({ highlight: reference });
    if (reference) {
      set({ activePage: reference.pageNumber });
    }
  },

  /** Uploads a file, waits for processing, then loads the document. */
  uploadFile: async (file) => {
    if (!file) {
      return;
    }

    set({ uploadState: "processing", highlight: null });
    useSessionStore.getState().setError(null);

    try {
      const { documentId } = await uploadDocument(file);
      const data = await fetchDocument(documentId);
      set({ loadedDocument: data, activePage: data.pages[0]?.pageNumber ?? 1 });
    } catch (error) {
      useSessionStore
        .getState()
        .setError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      set({ uploadState: "idle" });
    }
  }
}));

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
