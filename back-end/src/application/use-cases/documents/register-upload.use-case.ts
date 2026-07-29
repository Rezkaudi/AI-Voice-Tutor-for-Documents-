import type { DocumentRecord } from "@/domain/entities/document";
import { UnprocessableEntityError } from "@/domain/errors/app-error";
import type { DocumentRepository } from "@/domain/repositories/document-repository";
import type { FileStorage } from "@/domain/services/file-storage";
import type { UploadValidator } from "@/domain/logic/upload-validator";
import type { FileNaming } from "@/domain/logic/file-naming";
import type { PdfCompressor } from "@/domain/services/pdf-compressor";
import type { ExtractionQueue } from "@/domain/services/extraction-queue";
import type { Logger } from "@/domain/services/logger";

export interface RegisterUploadInput {
  readonly userId: string;
  readonly documentId: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly pageCount: number;
}

export interface RegisterUploadResult {
  documentId: string;
  status: DocumentRecord["status"];
}

export class RegisterUploadUseCase {
  constructor(
    private readonly repository: DocumentRepository,
    private readonly storage: FileStorage,
    private readonly validator: UploadValidator,
    private readonly naming: FileNaming,
    private readonly compressor: PdfCompressor,
    private readonly extractionQueue: ExtractionQueue,
    private readonly logger: Logger
  ) { }

  async execute(input: RegisterUploadInput): Promise<RegisterUploadResult> {
    const log = this.logger.scope("upload");

    const pageCount = Math.trunc(input.pageCount);
    if (!Number.isFinite(pageCount) || pageCount < 1) {
      throw new UnprocessableEntityError("We couldn't read any pages in this PDF.");
    }

    const validation = this.validator.validate({
      name: input.filename,
      type: input.mimeType,
      size: 0
    });
    if (!validation.ok) {
      log.warn(`rejected register — ${validation.error}`);
      throw new UnprocessableEntityError(validation.error);
    }

    const key = `${input.userId}/${input.documentId}/${this.naming.safe(input.filename)}`;
    const meta = await this.storage.head(key);
    if (!meta) {
      log.warn(`register missing S3 object for documentId=${input.documentId}`);
      throw new UnprocessableEntityError("The upload did not complete. Please try again.");
    }

    const contentType = input.mimeType || this.validator.defaultContentType(validation.kind);
    const storedSize = await this.shrinkStoredFile(key, contentType, meta.size);

    const now = new Date().toISOString();
    const record: DocumentRecord = {
      id: input.documentId,
      userId: input.userId,
      title: this.naming.toTitle(input.filename),
      fileName: input.filename,
      mimeType: contentType,
      fileType: validation.kind,
      fileSize: storedSize,
      status: "ready",
      pageCount,
      storagePath: key,
      createdAt: now,
      updatedAt: now,
      error: null
    };

    await this.repository.save(record);
    log.info(`registered documentId=${input.documentId} · ${pageCount} page(s) · ${storedSize} bytes`);

    try {
      await this.extractionQueue.enqueue({
        userId: input.userId,
        documentId: input.documentId
      });
    } catch (error) {
      log.warn(`documentId=${input.documentId} · could not queue extraction`, error);
    }

    return { documentId: input.documentId, status: record.status };
  }

  private async shrinkStoredFile(
    key: string,
    contentType: string,
    uploadedSize: number
  ): Promise<number> {
    const log = this.logger.scope("upload");

    try {
      const stored = await this.storage.get(key);
      if (!stored) return uploadedSize;

      const result = await this.compressor.compress(stored.body);
      if (!result.compressed) return uploadedSize;

      await this.storage.put({ key, body: result.body, contentType });
      log.info(
        `replaced ${key} with compressed copy · ` +
        `${result.bytesBefore} → ${result.bytesAfter} bytes`
      );
      return result.bytesAfter;
    } catch (error) {
      log.warn(
        `compression step skipped for ${key} — ` +
        `${error instanceof Error ? error.message : String(error)}`
      );
      return uploadedSize;
    }
  }
}
