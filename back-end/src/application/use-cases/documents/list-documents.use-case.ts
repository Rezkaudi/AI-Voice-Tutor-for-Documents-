import type { DocumentRecord } from "@/domain/entities/document";
import type { DocumentRepository } from "@/domain/repositories/document-repository";

/** Returns every processed document so the learner can switch between them. */
export class ListDocumentsUseCase {
  constructor(private readonly repository: DocumentRepository) {}

  async execute(): Promise<DocumentRecord[]> {
    return this.repository.listReady();
  }
}
