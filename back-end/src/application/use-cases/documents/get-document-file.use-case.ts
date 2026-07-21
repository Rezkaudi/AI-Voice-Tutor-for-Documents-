import { NotFoundError, ValidationError } from "@/domain/errors/app-error";
import type { DocumentFileUrlSigner } from "@/domain/logic/document-file-url";
import type { DocumentRepository } from "@/domain/repositories/document-repository";

export interface DocumentFileLocation {
  url: string;
  expiresInSeconds: number;
}

export class GetDocumentFileUseCase {
  constructor(
    private readonly repository: DocumentRepository,
    private readonly fileUrlSigner: DocumentFileUrlSigner
  ) { }

  async execute(documentId: unknown, userId: string): Promise<DocumentFileLocation> {
    if (typeof documentId !== "string" || documentId.trim().length === 0) {
      throw new ValidationError("A document id is required.");
    }

    const document = await this.repository.findById(documentId, userId);
    if (!document) {
      throw new NotFoundError("File not found.");
    }

    return {
      url: await this.fileUrlSigner.sign(document),
      expiresInSeconds: this.fileUrlSigner.ttl
    };
  }
}
