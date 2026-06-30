import type { DocumentSummary, LoadedDocument } from "@/types";
import { api, extractErrorMessage, resolveApiUrl } from "@/services/apiBase";

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

export async function uploadDocument(file: File): Promise<{ documentId: string }> {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const { data } = await api.post<{ documentId?: string }>("/api/documents", formData);
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
