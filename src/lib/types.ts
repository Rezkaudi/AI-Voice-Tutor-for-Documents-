export type UploadKind = "pdf" | "text" | "markdown";

export type DocumentStatus = "ready" | "failed";

export type DocumentRecord = {
  id: string;
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
};

export type DocumentPage = {
  id?: string;
  documentId?: string;
  pageNumber: number;
  text: string;
};

export type DocumentChunk = {
  id: string;
  documentId: string;
  pageNumber: number;
  chunkIndex: number;
  text: string;
  snippet: string;
  embedding?: number[] | null;
};

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type Reference = {
  pageNumber: number;
  snippet: string;
  chunkId?: string;
};
