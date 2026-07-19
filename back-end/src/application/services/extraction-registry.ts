export class ExtractionRegistry {
  private readonly active = new Map<string, number[]>();

  acquire(documentId: string): boolean {
    if (this.active.has(documentId)) return false;
    this.active.set(documentId, []);
    return true;
  }

  release(documentId: string): void {
    this.active.delete(documentId);
  }

  setActivePages(documentId: string, pageNumbers: number[]): void {
    if (!this.active.has(documentId)) return;
    this.active.set(documentId, [...pageNumbers]);
  }

  clearActivePages(documentId: string): void {
    if (!this.active.has(documentId)) return;
    this.active.set(documentId, []);
  }

  activePages(documentId: string): number[] {
    return [...(this.active.get(documentId) ?? [])];
  }
}
