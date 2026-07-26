import type { DocumentPage } from "@/domain/entities/document";

export interface DocumentTextExtractor {
  extractPages(pdfUrl: string, pageNumbers: number[]): Promise<DocumentPage[]>;
}
