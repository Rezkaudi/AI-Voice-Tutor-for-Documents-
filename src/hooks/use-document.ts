import { useCallback, useMemo, useState } from "react";
import type { DocumentPage, Reference } from "@/lib/types";
import type { LoadedDocument, UploadState } from "@/components/teaching/types";

type UseDocumentParams = {
  onError: (message: string | null) => void;
};

export type DocumentWorkspace = {
  loadedDocument: LoadedDocument | null;
  uploadState: UploadState;
  activePage: number;
  highlight: Reference | null;
  currentPage: DocumentPage | null;
  setActivePage: (page: number) => void;
  applyReference: (reference: Reference | null) => void;
  uploadFile: (file: File | null) => Promise<void>;
};

/**
 * Owns the uploaded document: handles upload + processing, tracks the active
 * page, and keeps the teacher's page reference highlight in sync.
 */
export function useDocument({ onError }: UseDocumentParams): DocumentWorkspace {
  const [loadedDocument, setLoadedDocument] = useState<LoadedDocument | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [activePage, setActivePage] = useState(1);
  const [highlight, setHighlight] = useState<Reference | null>(null);

  const currentPage = useMemo<DocumentPage | null>(() => {
    if (!loadedDocument) {
      return null;
    }
    return (
      loadedDocument.pages.find((page) => page.pageNumber === activePage) ??
      loadedDocument.pages[0] ??
      null
    );
  }, [activePage, loadedDocument]);

  const applyReference = useCallback((reference: Reference | null) => {
    setHighlight(reference);
    if (reference) {
      setActivePage(reference.pageNumber);
    }
  }, []);

  const loadDocument = useCallback(async (documentId: string) => {
    const response = await fetch(`/api/documents/${documentId}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "The processed document could not be loaded.");
    }
    setLoadedDocument(data);
    setActivePage(data.pages[0]?.pageNumber ?? 1);
  }, []);

  const uploadFile = useCallback(
    async (file: File | null) => {
      if (!file) {
        return;
      }

      setUploadState("processing");
      onError(null);
      setHighlight(null);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/documents", { method: "POST", body: formData });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "The file could not be uploaded.");
        }

        await loadDocument(data.documentId);
      } catch (error) {
        onError(error instanceof Error ? error.message : "Upload failed.");
      } finally {
        setUploadState("idle");
      }
    },
    [loadDocument, onError]
  );

  return {
    loadedDocument,
    uploadState,
    activePage,
    highlight,
    currentPage,
    setActivePage,
    applyReference,
    uploadFile
  };
}
