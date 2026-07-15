import type { LoadedDocumentDto } from "@/application/dto/document-dto";
import { NotFoundError, ValidationError } from "@/domain/errors/app-error";
import type { DocumentRepository } from "@/domain/repositories/document-repository";

export class GetDocumentUseCase {
  constructor(private readonly repository: DocumentRepository) { }

  async execute(documentId: unknown, userId: string): Promise<LoadedDocumentDto> {
    if (typeof documentId !== "string" || documentId.trim().length === 0) {
      throw new ValidationError("A document id is required.");
    }

    const document = await this.repository.findById(documentId, userId);
    if (!document) {
      throw new NotFoundError("Document not found.");
    }

    return { document, fileUrl: `/api/documents/${documentId}/file` };
  }
}
