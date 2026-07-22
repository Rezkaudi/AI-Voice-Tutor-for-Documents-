import type { DocumentRecord } from "@/domain/entities/document";
import type { FileStorage } from "@/domain/services/file-storage";

const CACHE_CONTROL = "private, max-age=31536000, immutable";

export interface SignedFileUrl {
  readonly url: string;
  readonly expiresAt: string;
}

export class DocumentFileUrlSigner {
  constructor(
    private readonly storage: FileStorage,
    private readonly ttlSeconds: number
  ) { }

  async sign(document: DocumentRecord): Promise<SignedFileUrl> {
    const url = await this.storage.presignGet(document.storagePath, {
      expiresInSeconds: this.ttlSeconds,
      fileName: document.fileName,
      contentType: document.mimeType,
      cacheControl: CACHE_CONTROL,
      stableWindowSeconds: this.ttlSeconds
    });
    return {
      url,
      expiresAt: new Date(Date.now() + this.ttlSeconds * 1000).toISOString()
    };
  }
}
