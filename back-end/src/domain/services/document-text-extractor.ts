import type { DocumentPage, UploadKind } from "@/domain/entities/document";

export interface DocumentTextExtractor {
  extract(buffer: Buffer, kind: UploadKind): Promise<DocumentPage[]>;
}
