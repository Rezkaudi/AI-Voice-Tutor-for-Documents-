import type { DocumentRecord } from "@/domain/entities/document";
import { UnprocessableEntityError } from "@/domain/errors/app-error";
import type { DocumentRepository } from "@/domain/repositories/document-repository";
import type { FileStorage } from "@/domain/services/file-storage";
import type { UploadValidator } from "@/domain/logic/upload-validator";
import type { FileNaming } from "@/domain/logic/file-naming";
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
      type: input.mimeType
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
    const now = new Date().toISOString();
    const record: DocumentRecord = {
      id: input.documentId,
      userId: input.userId,
      title: this.naming.toTitle(input.filename),
      fileName: input.filename,
      mimeType: contentType,
      fileType: validation.kind,
      fileSize: meta.size,
      status: "ready",
      pageCount,
      storagePath: key,
      createdAt: now,
      updatedAt: now,
      error: null
    };

    await this.repository.save(record);
    log.info(`registered documentId=${input.documentId} · ${pageCount} page(s) · ${meta.size} bytes`);

    return { documentId: input.documentId, status: record.status };
  }
}
