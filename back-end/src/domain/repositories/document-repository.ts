import type { DocumentChunk, DocumentPage, DocumentRecord } from "@/domain/entities/document";

export interface ChunkEmbeddingUpdate {
  id: string;
  embedding: number[] | null;
}

export interface ProcessedDocument {
  record: DocumentRecord;
  pages: DocumentPage[];
  chunks: DocumentChunk[];
}

export interface DocumentRepository {
  save(input: ProcessedDocument): Promise<void>;
  findById(id: string, userId: string): Promise<DocumentRecord | null>;
  listReady(userId: string): Promise<DocumentRecord[]>;
  delete(id: string, userId: string): Promise<void>;
  getPages(documentId: string): Promise<DocumentPage[]>;
  getChunks(documentId: string): Promise<DocumentChunk[]>;
  updateChunkEmbeddings(documentId: string, updates: ChunkEmbeddingUpdate[]): Promise<void>;
}
