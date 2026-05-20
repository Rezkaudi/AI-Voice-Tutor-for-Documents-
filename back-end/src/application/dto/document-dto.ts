import type { DocumentPage, DocumentRecord } from "@/domain/entities/document";

/**
 * Wire-format DTO returned by `GET /api/documents/:id`. The shape is a hard
 * contract with the React client's `LoadedDocument` type.
 */
export interface LoadedDocumentDto {
  document: DocumentRecord;
  pages: DocumentPage[];
  fileUrl: string | null;
}
