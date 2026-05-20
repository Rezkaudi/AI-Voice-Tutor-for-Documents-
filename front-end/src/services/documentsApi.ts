import type { LoadedDocument } from "@/lib/types";
import { api, extractErrorMessage } from "@/services/apiBase";

/**
 * Document transport. Talks to the backend's `/api/documents`.
 */

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
    throw new Error(extractErrorMessage(error, "The file could not be uploaded."));
  }
}

export async function fetchDocument(documentId: string): Promise<LoadedDocument> {
  try {
    const { data } = await api.get<LoadedDocument>(`/api/documents/${documentId}`);
    return data;
  } catch (error) {
    throw new Error(extractErrorMessage(error, "The processed document could not be loaded."));
  }
}
