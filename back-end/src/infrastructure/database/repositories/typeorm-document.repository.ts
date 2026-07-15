import type { DataSource } from "typeorm";
import type { DocumentRecord } from "@/domain/entities/document";
import type { DocumentRepository } from "@/domain/repositories/document-repository";
import { DocumentOrmEntity } from "../entities/document.entity";

export class TypeOrmDocumentRepository implements DocumentRepository {
  constructor(private readonly dataSource: DataSource) { }

  async save(record: DocumentRecord): Promise<void> {
    const document = new DocumentOrmEntity();
    document.id = record.id;
    document.userId = record.userId;
    document.title = record.title;
    document.fileName = record.fileName;
    document.mimeType = record.mimeType;
    document.fileType = record.fileType;
    document.fileSize = String(record.fileSize);
    document.status = record.status;
    document.pageCount = record.pageCount;
    document.storagePath = record.storagePath;
    document.createdAt = new Date(record.createdAt);
    document.updatedAt = new Date(record.updatedAt);
    document.error = record.error ?? null;
    await this.dataSource.getRepository(DocumentOrmEntity).save(document);
  }

  async findById(id: string, userId: string): Promise<DocumentRecord | null> {
    const row = await this.dataSource
      .getRepository(DocumentOrmEntity)
      .findOne({ where: { id, userId } });
    return row ? toDocumentRecord(row) : null;
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.dataSource.getRepository(DocumentOrmEntity).delete({ id, userId });
  }

  async listReady(userId: string): Promise<DocumentRecord[]> {
    const rows = await this.dataSource
      .getRepository(DocumentOrmEntity)
      .find({ where: { status: "ready", userId }, order: { updatedAt: "DESC" } });
    return rows.map(toDocumentRecord);
  }
}

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
