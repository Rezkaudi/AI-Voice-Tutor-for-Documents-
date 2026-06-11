/**
 * Core business entities for an uploaded lesson document.
 *
 * Framework-free types. The persistence layer keeps its own TypeORM entities
 * and maps to/from these — the domain never imports an ORM.
 */

/** The upload formats the tutor can ingest. PDF only. */
export type UploadKind = "pdf";

/** Processing outcome of an uploaded document. */
export type DocumentStatus = "ready" | "failed";

/** The metadata record for a processed document. */
export interface DocumentRecord {
  id: string;
  /** The owner — the user who uploaded it. Documents are private per user. */
  userId: string;
  title: string;
  fileName: string;
  mimeType: string;
  fileType: UploadKind;
  fileSize: number;
  status: DocumentStatus;
  pageCount: number;
  /** Object-storage key of the original uploaded file. */
  storagePath: string;
  createdAt: string;
  updatedAt: string;
  error?: string | null;
}

/** A single extracted page of a document. */
export interface DocumentPage {
  id?: string;
  documentId?: string;
  pageNumber: number;
  text: string;
}

/**
 * A retrieval unit: a slice of a page small enough to embed and rank. The
 * tutor's `search_document` tool searches over chunks, not whole pages.
 */
export interface DocumentChunk {
  id: string;
  documentId: string;
  pageNumber: number;
  chunkIndex: number;
  text: string;
  /** Vector embedding; `null` until the background embedding job fills it. */
  embedding?: number[] | null;
}
