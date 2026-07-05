import type { DocumentPage, UploadKind } from "@/domain/entities/document";

export interface DocumentTextExtractor {
  extract(buffer: Buffer, kind: UploadKind): Promise<DocumentPage[]>;
  countPages(buffer: Buffer): Promise<number>;
  extractPages(buffer: Buffer, pageNumbers: number[]): Promise<DocumentPage[]>;
}
