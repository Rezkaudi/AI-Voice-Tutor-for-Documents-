import type { DocumentRecord } from "@/domain/entities/document";
import type { DocumentRepository } from "@/domain/repositories/document-repository";

export class ListDocumentsUseCase {
  constructor(private readonly repository: DocumentRepository) { }

  async execute(userId: string): Promise<DocumentRecord[]> {
    return this.repository.listReady(userId);
  }
}
