import type { LoadedDocument } from "@/lib/types";

/**
 * Document transport. Talks to the original backend's `/api/documents`.
 */

/**
 * Uploads a lesson file for processing.
 * @param {File} file
 * @returns {Promise<{ documentId: string }>}
 */
export async function uploadDocument(file: File): Promise<{ documentId: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/documents", { method: "POST", body: formData });
  const data = (await response.json().catch(() => ({}))) as {
    documentId?: string;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(data.error || "The file could not be uploaded.");
  }
  if (!data.documentId) {
    throw new Error("The file could not be uploaded.");
  }
  return { documentId: data.documentId };
}

/**
 * Loads a processed document (record, pages, file URL) by id.
 * @param {string} documentId
 */
export async function fetchDocument(documentId: string): Promise<LoadedDocument> {
  const response = await fetch(`/api/documents/${documentId}`);
  const data = (await response.json().catch(() => ({}))) as LoadedDocument & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(data.error || "The processed document could not be loaded.");
  }
  return data;
}
