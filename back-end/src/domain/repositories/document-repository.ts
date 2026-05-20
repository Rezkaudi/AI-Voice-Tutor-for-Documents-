import type {
  DocumentChunk,
  DocumentPage,
  DocumentRecord
} from "@/domain/entities/document";

/** A chunk whose embedding has just been computed. */
export interface ChunkEmbeddingUpdate {
  id: string;
  embedding: number[] | null;
}

/** Everything needed to persist a freshly processed document. */
export interface ProcessedDocument {
  record: DocumentRecord;
  pages: DocumentPage[];
  chunks: DocumentChunk[];
}

/**
 * Persistence boundary for documents, their pages, and their retrieval chunks.
 * The application layer depends on this interface; the TypeORM implementation
 * lives in the infrastructure layer.
 */
export interface DocumentRepository {
  /** Persists a document with its pages and chunks in one transaction. */
  save(input: ProcessedDocument): Promise<void>;

  /** Loads a document record by id, or `null` when it does not exist. */
  findById(id: string): Promise<DocumentRecord | null>;

  /** Returns every ready document, newest first. */
  listReady(): Promise<DocumentRecord[]>;

  /** Deletes a document and its pages/chunks. A no-op when missing. */
  delete(id: string): Promise<void>;

  /** Returns a document's pages, ordered by page number. */
  getPages(documentId: string): Promise<DocumentPage[]>;

  /** Returns a document's chunks, ordered by chunk index. */
  getChunks(documentId: string): Promise<DocumentChunk[]>;

  /** Back-fills embeddings on chunks once the background job computes them. */
  updateChunkEmbeddings(
    documentId: string,
    updates: ChunkEmbeddingUpdate[]
  ): Promise<void>;
}
