import type { DocumentPage, DocumentRecord } from "@/domain/entities/document";

export interface LoadedDocumentDto {
  document: DocumentRecord;
  pages: DocumentPage[];
  fileUrl: string | null;
}
