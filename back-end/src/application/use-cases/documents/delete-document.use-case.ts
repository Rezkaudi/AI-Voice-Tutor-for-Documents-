import { NotFoundError, ValidationError } from "@/domain/errors/app-error";
import type { DocumentRepository } from "@/domain/repositories/document-repository";
import type { FileStorage } from "@/domain/services/file-storage";
import type { DocumentPagesStore } from "@/application/services/document-pages-store";

export class DeleteDocumentUseCase {
  constructor(
    private readonly repository: DocumentRepository,
    private readonly fileStorage: FileStorage,
    private readonly pagesStore: DocumentPagesStore
  ) { }

  async execute(documentId: unknown, userId: string): Promise<void> {
    if (typeof documentId !== "string" || documentId.trim().length === 0) {
      throw new ValidationError("A document id is required.");
    }

    const document = await this.repository.findById(documentId, userId);
    if (!document) {
      throw new NotFoundError("Document not found.");
    }

    await this.fileStorage.delete(document.storagePath);
    await this.pagesStore.delete(userId, documentId);
    await this.repository.delete(documentId, userId);
  }
}
