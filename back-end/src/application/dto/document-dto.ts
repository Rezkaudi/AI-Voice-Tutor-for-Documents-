import type { DocumentRecord } from "@/domain/entities/document";

export interface LoadedDocumentDto {
  document: DocumentRecord;
  fileUrl: string | null;
}
