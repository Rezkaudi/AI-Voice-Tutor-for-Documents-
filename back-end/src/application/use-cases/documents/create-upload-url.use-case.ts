import { UnprocessableEntityError } from "@/domain/errors/app-error";
import type { FileStorage } from "@/domain/services/file-storage";
import type { IdGenerator } from "@/domain/services/id-generator";
import type { UploadValidator } from "@/domain/logic/upload-validator";
import type { FileNaming } from "@/domain/logic/file-naming";
import type { Logger } from "@/domain/services/logger";

export interface CreateUploadUrlInput {
  readonly userId: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly size: number;
}

export interface CreateUploadUrlResult {
  readonly documentId: string;
  readonly key: string;
  readonly url: string;
  readonly contentType: string;
}

export class CreateUploadUrlUseCase {
  constructor(
    private readonly storage: FileStorage,
    private readonly validator: UploadValidator,
    private readonly naming: FileNaming,
    private readonly idGenerator: IdGenerator,
    private readonly logger: Logger
  ) { }

  async execute(input: CreateUploadUrlInput): Promise<CreateUploadUrlResult> {
    const log = this.logger.scope("upload");
    const validation = this.validator.validate({
      name: input.filename,
      type: input.mimeType
    });
    if (!validation.ok) {
      log.warn(`rejected upload-url request — ${validation.error}`);
      throw new UnprocessableEntityError(validation.error);
    }

    const contentType = input.mimeType || this.validator.defaultContentType(validation.kind);
    const documentId = this.idGenerator.uuid();
    const key = `${input.userId}/${documentId}/${this.naming.safe(input.filename)}`;
    const url = await this.storage.presignPut(key, contentType);
    log.info(`issued presigned PUT for documentId=${documentId}`);

    return { documentId, key, url, contentType };
  }
}
