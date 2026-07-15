import type { DocumentRecord } from "@/domain/entities/document";

export interface DocumentRepository {
  save(record: DocumentRecord): Promise<void>;
  findById(id: string, userId: string): Promise<DocumentRecord | null>;
  listReady(userId: string): Promise<DocumentRecord[]>;
  delete(id: string, userId: string): Promise<void>;
}
