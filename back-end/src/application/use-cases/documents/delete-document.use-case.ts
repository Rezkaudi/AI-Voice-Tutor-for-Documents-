import { NotFoundError, ValidationError } from "@/domain/errors/app-error";
import type { DocumentRepository } from "@/domain/repositories/document-repository";
import type { FileStorage } from "@/domain/services/file-storage";

/**
 * Removes a document from persistent storage: deletes the original file from
 * object storage first, then drops the document row (pages and chunks cascade).
 */
export class DeleteDocumentUseCase {
  constructor(
    private readonly repository: DocumentRepository,
    private readonly fileStorage: FileStorage
  ) {}

  async execute(documentId: unknown, userId: string): Promise<void> {
    if (typeof documentId !== "string" || documentId.trim().length === 0) {
      throw new ValidationError("A document id is required.");
    }

    const document = await this.repository.findById(documentId, userId);
    if (!document) {
      throw new NotFoundError("Document not found.");
    }

    // Delete the file first so a partial failure leaves an orphaned row rather
    // than an orphaned S3 object (cheaper to clean up).
    await this.fileStorage.delete(document.storagePath);
    await this.repository.delete(documentId, userId);
  }
}
