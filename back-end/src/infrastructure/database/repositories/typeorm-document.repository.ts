import type { DataSource } from "typeorm";
import type {
  DocumentChunk,
  DocumentPage,
  DocumentRecord
} from "@/domain/entities/document";
import type {
  ChunkEmbeddingUpdate,
  DocumentRepository,
  ProcessedDocument
} from "@/domain/repositories/document-repository";
import type { IdGenerator } from "@/domain/services/id-generator";
import { DocumentOrmEntity } from "../entities/document.entity";
import { DocumentPageOrmEntity } from "../entities/document-page.entity";
import { DocumentChunkOrmEntity } from "../entities/document-chunk.entity";

/**
 * TypeORM-backed `DocumentRepository`. The only place that knows about ORM
 * entities; it maps between them and the domain types.
 */
export class TypeOrmDocumentRepository implements DocumentRepository {
  constructor(
    private readonly dataSource: DataSource,
    private readonly idGenerator: IdGenerator
  ) {}

  /** Persists the document, its pages, and its chunks in one transaction. */
  async save(input: ProcessedDocument): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const document = new DocumentOrmEntity();
      document.id = input.record.id;
      document.userId = input.record.userId;
      document.title = input.record.title;
      document.fileName = input.record.fileName;
      document.mimeType = input.record.mimeType;
      document.fileType = input.record.fileType;
      document.fileSize = String(input.record.fileSize);
      document.status = input.record.status;
      document.pageCount = input.record.pageCount;
      document.storagePath = input.record.storagePath;
      document.createdAt = new Date(input.record.createdAt);
      document.updatedAt = new Date(input.record.updatedAt);
      document.error = input.record.error ?? null;
      await manager.save(document);

      const pages = input.pages.map((page) => {
        const row = new DocumentPageOrmEntity();
        row.id = page.id ?? this.idGenerator.uuid();
        row.documentId = input.record.id;
        row.pageNumber = page.pageNumber;
        row.text = page.text;
        return row;
      });
      await manager.save(pages);

      const chunks = input.chunks.map((chunk) => {
        const row = new DocumentChunkOrmEntity();
        row.id = chunk.id;
        row.documentId = input.record.id;
        row.pageNumber = chunk.pageNumber;
        row.chunkIndex = chunk.chunkIndex;
        row.text = chunk.text;
        row.embedding = chunk.embedding ?? null;
        return row;
      });
      await manager.save(chunks);
    });
  }

  async findById(id: string, userId: string): Promise<DocumentRecord | null> {
    const row = await this.dataSource
      .getRepository(DocumentOrmEntity)
      .findOne({ where: { id, userId } });
    return row ? toDocumentRecord(row) : null;
  }

  async delete(id: string, userId: string): Promise<void> {
    // Pages and chunks cascade via the FK ON DELETE CASCADE.
    await this.dataSource.getRepository(DocumentOrmEntity).delete({ id, userId });
  }

  async listReady(userId: string): Promise<DocumentRecord[]> {
    const rows = await this.dataSource
      .getRepository(DocumentOrmEntity)
      .find({ where: { status: "ready", userId }, order: { updatedAt: "DESC" } });
    return rows.map(toDocumentRecord);
  }

  async getPages(documentId: string): Promise<DocumentPage[]> {
    const rows = await this.dataSource
      .getRepository(DocumentPageOrmEntity)
      .find({ where: { documentId }, order: { pageNumber: "ASC" } });
    return rows.map((row) => ({
      id: row.id,
      documentId: row.documentId,
      pageNumber: row.pageNumber,
      text: row.text
    }));
  }

  async getChunks(documentId: string): Promise<DocumentChunk[]> {
    const rows = await this.dataSource
      .getRepository(DocumentChunkOrmEntity)
      .find({ where: { documentId }, order: { chunkIndex: "ASC" } });
    return rows.map((row) => ({
      id: row.id,
      documentId: row.documentId,
      pageNumber: row.pageNumber,
      chunkIndex: row.chunkIndex,
      text: row.text,
      embedding: row.embedding
    }));
  }

  async updateChunkEmbeddings(
    documentId: string,
    updates: ChunkEmbeddingUpdate[]
  ): Promise<void> {
    const withEmbedding = updates.filter(
      (update) => update.embedding && update.embedding.length > 0
    );
    if (withEmbedding.length === 0) {
      return;
    }
    const repository = this.dataSource.getRepository(DocumentChunkOrmEntity);
    // Update in small concurrent waves rather than flooding the DB at once.
    for (let index = 0; index < withEmbedding.length; index += 20) {
      const wave = withEmbedding.slice(index, index + 20);
      await Promise.all(
        wave.map((update) =>
          repository.update(
            { id: update.id, documentId },
            { embedding: update.embedding }
          )
        )
      );
    }
  }
}

/** Maps a persistence row into the framework-free domain record. */
function toDocumentRecord(row: DocumentOrmEntity): DocumentRecord {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    fileName: row.fileName,
    mimeType: row.mimeType,
    fileType: row.fileType,
    fileSize: Number(row.fileSize),
    status: row.status,
    pageCount: row.pageCount,
    storagePath: row.storagePath,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    error: row.error
  };
}
