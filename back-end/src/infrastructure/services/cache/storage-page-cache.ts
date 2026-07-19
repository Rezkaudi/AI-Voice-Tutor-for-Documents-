import type { DocumentPagesStore } from "@/application/services/document-pages-store";
import type { PageCache } from "@/domain/services/page-cache";
import { InMemoryPageCache } from "./in-memory-page-cache";

export class StoragePageCache implements PageCache {
  private readonly memory = new InMemoryPageCache();

  constructor(private readonly pagesStore: DocumentPagesStore) { }

  async get(userId: string, documentId: string, pageNumber: number): Promise<string | undefined> {
    const inMemory = await this.memory.get(userId, documentId, pageNumber);
    if (inMemory !== undefined) {
      return inMemory;
    }
    const stored = await this.pagesStore.read(userId, documentId);
    if (!stored) {
      return undefined;
    }
    for (const [key, text] of Object.entries(stored.file.pages)) {
      await this.memory.set(userId, documentId, Number(key), text);
    }
    return stored.file.pages[String(pageNumber)];
  }

  async set(userId: string, documentId: string, pageNumber: number, text: string): Promise<void> {
    await this.memory.set(userId, documentId, pageNumber, text);
    await this.pagesStore.mergePages(userId, documentId, [{ pageNumber, text }]);
  }

  async retain(userId: string, documentId: string, pageNumbers: number[]): Promise<void> {
    await this.memory.retain(userId, documentId, pageNumbers);
  }

  async clear(userId: string): Promise<void> {
    await this.memory.clear(userId);
  }
}
