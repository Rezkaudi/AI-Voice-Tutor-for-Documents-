export class ExtractionRegistry {
  private readonly active = new Set<string>();

  acquire(documentId: string): boolean {
    if (this.active.has(documentId)) return false;
    this.active.add(documentId);
    return true;
  }

  release(documentId: string): void {
    this.active.delete(documentId);
  }
}
