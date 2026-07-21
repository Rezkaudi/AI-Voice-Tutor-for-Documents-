import type { DocumentRecord } from "@/domain/entities/document";
import { UnprocessableEntityError } from "@/domain/errors/app-error";
import type { DocumentRepository } from "@/domain/repositories/document-repository";
import type { DocumentTextExtractor } from "@/domain/services/document-text-extractor";
import type { FileStorage } from "@/domain/services/file-storage";
import type { IdGenerator } from "@/domain/services/id-generator";
import type { UploadValidator } from "@/domain/logic/upload-validator";
import type { FileNaming } from "@/domain/logic/file-naming";
import type { Logger } from "@/domain/services/logger";

export interface UploadDocumentInput {
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

export class UploadDocumentUseCase {
  constructor(
    private readonly repository: DocumentRepository,
    private readonly storage: FileStorage,
    private readonly extractor: DocumentTextExtractor,
    private readonly validator: UploadValidator,
    private readonly naming: FileNaming,
    private readonly idGenerator: IdGenerator,
    private readonly logger: Logger
  ) { }

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
    log.info(`validated as ${validation.kind} → counting pages`);

    const id = this.idGenerator.uuid();

    const pageCount = await this.extractor.countPages(input.buffer);
    if (pageCount < 1) {
      log.warn("PDF reports no pages — rejecting");
      throw new UnprocessableEntityError(
        "We couldn't read any pages in this PDF."
      );
    }
    log.info(`documentId=${id} · ${pageCount} page(s) · text extraction deferred`);

    const storagePath = `${input.userId}/${id}/${this.naming.safe(input.filename)}`;
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
      pageCount,
      storagePath,
      createdAt: now,
      updatedAt: now,
      error: null
    };

    await this.repository.save(record);
    log.info(`persisted document row · status=${record.status}`);

    return { documentId: id, status: record.status };
  }
}
