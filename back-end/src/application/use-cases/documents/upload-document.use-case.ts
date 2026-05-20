import { randomUUID } from "node:crypto";
import type {
  DocumentChunk,
  DocumentRecord
} from "@/domain/entities/document";
import { UnprocessableEntityError } from "@/domain/errors/app-error";
import type { DocumentRepository } from "@/domain/repositories/document-repository";
import type { DocumentTextExtractor } from "@/domain/services/document-text-extractor";
import type { EmbeddingService } from "@/domain/services/embedding-service";
import type { FileStorage } from "@/domain/services/file-storage";
import {
  chunkDocumentPages,
  safeFileName,
  titleFromFileName,
  validateUploadFile
} from "@/application/services/document-processing";
import { logger } from "@/shared/logger";

/** The uploaded file as received by the application layer. */
export interface UploadDocumentInput {
  readonly buffer: Buffer;
  readonly filename: string;
  readonly mimeType: string;
  readonly size: number;
}

export interface UploadDocumentResult {
  documentId: string;
  status: DocumentRecord["status"];
}

/**
 * Processes an uploaded lesson file:
 *   1. validates type and size,
 *   2. extracts ordered pages of text,
 *   3. chunks the pages for retrieval,
 *   4. stores the original file in object storage,
 *   5. persists the document, pages, and chunks (embeddings empty),
 *   6. computes embeddings *in the background* so the upload returns fast —
 *      until they land, chat retrieval falls back to keyword ranking.
 */
export class UploadDocumentUseCase {
  constructor(
    private readonly repository: DocumentRepository,
    private readonly storage: FileStorage,
    private readonly extractor: DocumentTextExtractor,
    private readonly embeddings: EmbeddingService
  ) {}

  async execute(input: UploadDocumentInput): Promise<UploadDocumentResult> {
    const validation = validateUploadFile({
      name: input.filename,
      type: input.mimeType,
      size: input.size
    });
    if (!validation.ok) {
      throw new UnprocessableEntityError(validation.error);
    }

    const id = randomUUID();
    const pages = (await this.extractor.extract(input.buffer, validation.kind)).map(
      (page) => ({ ...page, id: randomUUID(), documentId: id })
    );
    const chunks: DocumentChunk[] = chunkDocumentPages(pages).map((chunk) => ({
      ...chunk,
      documentId: id
    }));

    if (chunks.length === 0) {
      throw new UnprocessableEntityError(
        "No searchable text was found in this file."
      );
    }

    const storagePath = `${id}/${safeFileName(input.filename)}`;
    await this.storage.put({
      key: storagePath,
      body: input.buffer,
      contentType: input.mimeType || contentTypeFor(validation.kind)
    });

    const now = new Date().toISOString();
    const record: DocumentRecord = {
      id,
      title: titleFromFileName(input.filename),
      fileName: input.filename,
      mimeType: input.mimeType || contentTypeFor(validation.kind),
      fileType: validation.kind,
      fileSize: input.size,
      status: "ready",
      pageCount: pages.length,
      storagePath,
      createdAt: now,
      updatedAt: now,
      error: null
    };

    await this.repository.save({ record, pages, chunks });

    // Fire-and-forget: embeddings improve retrieval but the learner can start
    // immediately. Failures are logged, never surfaced to the upload caller.
    void this.embedInBackground(id, chunks);

    return { documentId: id, status: record.status };
  }

  /** Computes and stores chunk embeddings after the response is sent. */
  private async embedInBackground(
    documentId: string,
    chunks: DocumentChunk[]
  ): Promise<void> {
    if (!this.embeddings.isAvailable()) {
      return;
    }
    try {
      const vectors = await this.embeddings.embedTexts(
        chunks.map((chunk) => chunk.text)
      );
      await this.repository.updateChunkEmbeddings(
        documentId,
        chunks.map((chunk, index) => ({
          id: chunk.id,
          embedding: vectors[index] ?? null
        }))
      );
      logger.info(`Embeddings stored for document ${documentId}.`);
    } catch (error) {
      logger.error(`Background embedding failed for document ${documentId}`, error);
    }
  }
}

/** Default content type for an upload kind when the client sent none. */
function contentTypeFor(kind: string): string {
  if (kind === "pdf") {
    return "application/pdf";
  }
  if (kind === "markdown") {
    return "text/markdown";
  }
  return "text/plain";
}
