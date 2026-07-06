import axios from "axios";
import type { DocumentSummary, LoadedDocument } from "@/types";
import { api, extractErrorMessage, resolveApiUrl } from "@/services/apiBase";
import { countPdfPages } from "@/lib/pdfPageCount";

export async function endLessonSession(): Promise<void> {
  try {
    await api.post("/api/documents/session/end");
  } catch {
  }
}

export async function deleteDocument(documentId: string): Promise<void> {
  try {
    await api.delete(`/api/documents/${documentId}`);
  } catch (error) {
    throw new Error(extractErrorMessage(error, "The document could not be deleted."), {
      cause: error
    });
  }
}

export async function listDocuments(): Promise<DocumentSummary[]> {
  try {
    const { data } = await api.get<{ documents: DocumentSummary[] }>("/api/documents");
    return data.documents ?? [];
  } catch (error) {
    throw new Error(extractErrorMessage(error, "Your documents could not be loaded."), {
      cause: error
    });
  }
}

export async function uploadDocument(
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ documentId: string }> {
  const mimeType = file.type || "application/pdf";

  try {
    // 1) Ask our API for a short-lived presigned PUT URL (instant).
    const { data: presign } = await api.post<{
      documentId?: string;
      url?: string;
      contentType?: string;
    }>("/api/documents/upload-url", {
      filename: file.name,
      mimeType,
      size: file.size
    });
    if (!presign.documentId || !presign.url) {
      throw new Error("The file could not be uploaded.");
    }

    // 2) PUT the bytes directly to S3 — this is the real upload the bar tracks.
    //    Use a bare axios call (no credentials/baseURL) so nothing extra is sent.
    await axios.put(presign.url, file, {
      headers: { "Content-Type": presign.contentType || mimeType },
      onUploadProgress: (event) => {
        if (!onProgress) return;
        const total = event.total ?? file.size;
        if (!total) return;
        onProgress(Math.min(100, Math.round((event.loaded / total) * 100)));
      }
    });

    // 3) Count pages in the browser and register the document (fast, no transfer).
    const pageCount = await countPdfPages(file);
    const { data } = await api.post<{ documentId?: string }>("/api/documents/register", {
      documentId: presign.documentId,
      filename: file.name,
      mimeType,
      pageCount
    });
    if (!data.documentId) {
      throw new Error("The file could not be uploaded.");
    }
    return { documentId: data.documentId };
  } catch (error) {
    throw new Error(extractErrorMessage(error, "The file could not be uploaded."), {
      cause: error
    });
  }
}

export async function fetchDocument(documentId: string): Promise<LoadedDocument> {
  try {
    const { data } = await api.get<LoadedDocument>(`/api/documents/${documentId}`);
    return { ...data, fileUrl: resolveApiUrl(data.fileUrl) };
  } catch (error) {
    throw new Error(extractErrorMessage(error, "The processed document could not be loaded."), {
      cause: error
    });
  }
}
