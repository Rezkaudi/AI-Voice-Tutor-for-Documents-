export type UploadKind = "pdf";

export type DocumentStatus = "ready" | "failed";

export interface DocumentRecord {
  id: string;
  userId: string;
  title: string;
  fileName: string;
  mimeType: string;
  fileType: UploadKind;
  fileSize: number;
  status: DocumentStatus;
  pageCount: number;
  storagePath: string;
  createdAt: string;
  updatedAt: string;
  error?: string | null;
}

export interface DocumentPage {
  id?: string;
  documentId?: string;
  pageNumber: number;
  text: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  pageNumber: number;
  chunkIndex: number;
  text: string;
  embedding?: number[] | null;
}
