import type { DocumentRecord } from "@/domain/entities/document";
import type { FileStorage } from "@/domain/services/file-storage";

export class DocumentFileUrlSigner {
  constructor(
    private readonly storage: FileStorage,
    private readonly ttlSeconds: number
  ) { }

  get ttl(): number {
    return this.ttlSeconds;
  }

  sign(document: DocumentRecord): Promise<string> {
    return this.storage.presignGet(document.storagePath, {
      expiresInSeconds: this.ttlSeconds,
      fileName: document.fileName,
      contentType: document.mimeType
    });
  }
}
