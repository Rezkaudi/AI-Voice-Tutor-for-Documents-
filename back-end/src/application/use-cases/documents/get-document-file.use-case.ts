import { NotFoundError, ValidationError } from "@/domain/errors/app-error";
import type { DocumentRepository } from "@/domain/repositories/document-repository";
import type { FileStorage } from "@/domain/services/file-storage";

export interface DocumentFileResult {
  body: Buffer;
  contentType: string;
  fileName: string;
}

export class GetDocumentFileUseCase {
  constructor(
    private readonly repository: DocumentRepository,
    private readonly storage: FileStorage
  ) { }

  async execute(documentId: unknown, userId: string): Promise<DocumentFileResult> {
    if (typeof documentId !== "string" || documentId.trim().length === 0) {
      throw new ValidationError("A document id is required.");
    }

    const document = await this.repository.findById(documentId, userId);
    if (!document) {
      throw new NotFoundError("File not found.");
    }

    const file = await this.storage.get(document.storagePath);
    if (!file) {
      throw new NotFoundError("File not found.");
    }

    return {
      body: file.body,
      contentType: file.contentType || document.mimeType,
      fileName: document.fileName
    };
  }
}
