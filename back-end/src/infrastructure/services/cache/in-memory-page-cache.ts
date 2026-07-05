import type { PageCache } from "@/domain/services/page-cache";

export class InMemoryPageCache implements PageCache {
  private readonly byUser = new Map<string, Map<string, string>>();

  async get(userId: string, documentId: string, pageNumber: number): Promise<string | undefined> {
    return this.byUser.get(userId)?.get(this.keyOf(documentId, pageNumber));
  }

  async set(userId: string, documentId: string, pageNumber: number, text: string): Promise<void> {
    let pages = this.byUser.get(userId);
    if (!pages) {
      pages = new Map();
      this.byUser.set(userId, pages);
    }
    pages.set(this.keyOf(documentId, pageNumber), text);
  }

  async retain(userId: string, documentId: string, pageNumbers: number[]): Promise<void> {
    const pages = this.byUser.get(userId);
    if (!pages) return;
    const keep = new Set(pageNumbers.map((pageNumber) => this.keyOf(documentId, pageNumber)));
    for (const key of pages.keys()) {
      if (!keep.has(key)) pages.delete(key);
    }
    if (pages.size === 0) this.byUser.delete(userId);
  }

  async clear(userId: string): Promise<void> {
    this.byUser.delete(userId);
  }

  private keyOf(documentId: string, pageNumber: number): string {
    return `${documentId}:${pageNumber}`;
  }
}
