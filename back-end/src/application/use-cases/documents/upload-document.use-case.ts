import type {
  DocumentChunk,
  DocumentRecord
} from "@/domain/entities/document";
import { UnprocessableEntityError } from "@/domain/errors/app-error";
import type { DocumentRepository } from "@/domain/repositories/document-repository";
import type { DocumentTextExtractor } from "@/domain/services/document-text-extractor";
import type { EmbeddingService } from "@/domain/services/embedding-service";
import type { FileStorage } from "@/domain/services/file-storage";
import type { IdGenerator } from "@/domain/services/id-generator";
import type { DocumentChunker } from "@/domain/logic/document-chunker";
import type { UploadValidator } from "@/domain/logic/upload-validator";
import type { FileNaming } from "@/domain/logic/file-naming";
import type { Logger } from "@/domain/services/logger";

/** The uploaded file as received by the application layer. */
export interface UploadDocumentInput {
  /** The owner this document belongs to. */
  readonly userId: string;
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
 *   3. stores the original file in object storage,
 *   4. persists the document and its pages.
 *
 * NOTE: chunking and embedding are currently DISABLED (see the inline notes in
 * `execute` and the unused `embedInBackground` below). The tutor teaches only
 * the learner's selected pages, so chunks/embeddings are never read. Re-enable
 * those two blocks to restore whole-document retrieval.
 */
export class UploadDocumentUseCase {
  constructor(
    private readonly repository: DocumentRepository,
    private readonly storage: FileStorage,
    private readonly extractor: DocumentTextExtractor,
    private readonly embeddings: EmbeddingService,
    private readonly validator: UploadValidator,
    private readonly chunker: DocumentChunker,
    private readonly naming: FileNaming,
    private readonly idGenerator: IdGenerator,
    private readonly logger: Logger
  ) {}

  async execute(input: UploadDocumentInput): Promise<UploadDocumentResult> {
    const log = this.logger.scope("upload");
    log.info(
      `received "${input.filename}" · ${(input.size / 1024).toFixed(1)} KiB · ` +
        `${input.mimeType || "(no mime)"}`
    );

    const validation = this.validator.validate({
      name: input.filename,
      type: input.mimeType,
      size: input.size
    });
    if (!validation.ok) {
      log.warn(`rejected — ${validation.error}`);
      throw new UnprocessableEntityError(validation.error);
    }
    log.info(`validated as ${validation.kind} → extracting text`);

    const id = this.idGenerator.uuid();
    const pages = (await this.extractor.extract(input.buffer, validation.kind)).map(
      (page) => ({ ...page, id: this.idGenerator.uuid(), documentId: id })
    );
    log.info(`extracted ${pages.length} page(s)`);

    // ─── CHUNKING + EMBEDDING DISABLED ───────────────────────────────────────
    // The tutor now teaches only the learner's selected pages (their full text
    // is injected straight into the prompt), so chunks and their embeddings are
    // never read at answer time. We skip creating and storing them to save the
    // embedding API cost, the DB rows, and the upload latency. Re-enable BOTH
    // this block and `embedInBackground` below to restore whole-document
    // retrieval (`search_document`).
    // const chunks: DocumentChunk[] = this.chunker.chunk(pages).map((chunk) => ({
    //   ...chunk,
    //   documentId: id
    // }));
    const chunks: DocumentChunk[] = [];

    // Reject files with no extractable text. This used to check the chunk count;
    // with chunking off we check the page text directly instead.
    const hasText = pages.some((page) => page.text.trim().length > 0);
    if (!hasText) {
      log.warn("no searchable text found in any page — rejecting");
      throw new UnprocessableEntityError(
        "No searchable text was found in this file."
      );
    }
    log.info(`documentId=${id} (chunking/embedding disabled)`);

    const storagePath = `${id}/${this.naming.safe(input.filename)}`;
    await this.storage.put({
      key: storagePath,
      body: input.buffer,
      contentType: input.mimeType || this.validator.defaultContentType(validation.kind)
    });
    log.info(`stored original file at ${storagePath}`);

    const now = new Date().toISOString();
    const record: DocumentRecord = {
      id,
      userId: input.userId,
      title: this.naming.toTitle(input.filename),
      fileName: input.filename,
      mimeType: input.mimeType || this.validator.defaultContentType(validation.kind),
      fileType: validation.kind,
      fileSize: input.size,
      status: "ready",
      pageCount: pages.length,
      storagePath,
      createdAt: now,
      updatedAt: now,
      error: null
    };

    // `chunks` is intentionally empty (see note above), so no chunk rows are
    // written — only the document record and its pages are persisted.
    await this.repository.save({ record, pages, chunks });
    log.info(`persisted document and pages · status=${record.status}`);

    // ─── EMBEDDING DISABLED (see note above) ─────────────────────────────────
    // No chunks were created, so there is nothing to embed. Re-enable alongside
    // the chunking block above to restore background embeddings.
    // log.info(`embedding ${chunks.length} chunk(s) in background → returning now`);
    // void this.embedInBackground(id, chunks, log);

    return { documentId: id, status: record.status };
  }

  /** Computes and stores chunk embeddings after the response is sent. */
  private async embedInBackground(
    documentId: string,
    chunks: DocumentChunk[],
    log: Logger
  ): Promise<void> {
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
      log.info(`embeddings stored for document ${documentId}`);
    } catch (error) {
      log.error(`background embedding failed for document ${documentId}`, error);
    }
  }
}
