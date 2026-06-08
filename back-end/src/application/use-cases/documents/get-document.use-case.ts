import type { LoadedDocumentDto } from "@/application/dto/document-dto";
import { NotFoundError, ValidationError } from "@/domain/errors/app-error";
import type { DocumentRepository } from "@/domain/repositories/document-repository";

/**
 * Loads a processed document — its record, pages, and the URL the front-end
 * fetches the original file from — for the document board.
 */
export class GetDocumentUseCase {
  constructor(private readonly repository: DocumentRepository) {}

  async execute(documentId: unknown, userId: string): Promise<LoadedDocumentDto> {
    if (typeof documentId !== "string" || documentId.trim().length === 0) {
      throw new ValidationError("A document id is required.");
    }

    const document = await this.repository.findById(documentId, userId);
    if (!document) {
      throw new NotFoundError("Document not found.");
    }

    const pages = await this.repository.getPages(documentId);
    // The file is served through the authenticated proxy route, never a raw
    // storage URL — so the original document stays private behind the gate.
    return { document, pages, fileUrl: `/api/documents/${documentId}/file` };
  }
}
