import type { DocumentPage } from "@/domain/entities/document";

export interface ExtractPagesOptions {
  /**
   * OCR model to recognise with ("default" | "arabic"). When omitted the
   * extractor detects the script itself — the historical behaviour. Resolving
   * it once per document and passing it here skips a repeated two-page probe
   * without changing which model ends up reading the page.
   */
  readonly model?: string;
  readonly signal?: AbortSignal;
}

export interface DocumentTextExtractor {
  extractPages(
    pdfUrl: string,
    pageNumbers: number[],
    options?: ExtractPagesOptions
  ): Promise<DocumentPage[]>;

  /** Resolves the OCR model for a document once, when the extractor supports it. */
  resolveModel?(pdfUrl: string, signal?: AbortSignal): Promise<string | null>;
}
