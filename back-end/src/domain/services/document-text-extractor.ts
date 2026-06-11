import type { DocumentPage, UploadKind } from "@/domain/entities/document";

/**
 * Turns an uploaded PDF's bytes into ordered, plain-text pages.
 *
 * PDFs are split per rendered page. Implementations throw a `ValidationError`
 * for files they cannot read (e.g. a scanned, image-only PDF).
 */
export interface DocumentTextExtractor {
  extract(buffer: Buffer, kind: UploadKind): Promise<DocumentPage[]>;
}
