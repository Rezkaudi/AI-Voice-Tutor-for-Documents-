export interface PageCache {
  get(userId: string, documentId: string, pageNumber: number): Promise<string | undefined>;
  set(userId: string, documentId: string, pageNumber: number, text: string): Promise<void>;
  retain(userId: string, documentId: string, pageNumbers: number[]): Promise<void>;
  clear(userId: string): Promise<void>;
}
