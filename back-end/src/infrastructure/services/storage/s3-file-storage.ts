import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";
import { UpstreamError } from "@/domain/errors/app-error";
import type {
  FileStorage,
  RetrievedFile,
  RetrievedFileStream,
  StoredFileInput,
  StoredFileMetadata
} from "@/domain/services/file-storage";
import type { EnvConfig } from "@/config/env.config";

const DEFAULT_PRESIGN_TTL_SECONDS = 15 * 60;

export class S3FileStorage implements FileStorage {
  private readonly client: S3Client;

  constructor(private readonly config: EnvConfig) {
    this.client = new S3Client({
      region: config.S3_REGION,
      credentials: {
        accessKeyId: config.S3_ACCESS_KEY_ID,
        secretAccessKey: config.S3_SECRET_ACCESS_KEY
      }
    });
  }

  async put(input: StoredFileInput): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.config.S3_BUCKET,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType
        })
      );
    } catch (error) {
      throw new UpstreamError(
        `Failed to store the document file: ${describe(error)}`
      );
    }
  }

  async presignPut(
    key: string,
    contentType: string,
    expiresInSeconds: number = DEFAULT_PRESIGN_TTL_SECONDS
  ): Promise<string> {
    try {
      return await getSignedUrl(
        this.client,
        new PutObjectCommand({
          Bucket: this.config.S3_BUCKET,
          Key: key,
          ContentType: contentType
        }),
        { expiresIn: expiresInSeconds }
      );
    } catch (error) {
      throw new UpstreamError(`Failed to prepare the upload URL: ${describe(error)}`);
    }
  }

  async head(key: string): Promise<StoredFileMetadata | null> {
    try {
      const response = await this.client.send(
        new HeadObjectCommand({ Bucket: this.config.S3_BUCKET, Key: key })
      );
      return {
        size: response.ContentLength ?? 0,
        contentType: response.ContentType ?? "application/octet-stream"
      };
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }
      throw new UpstreamError(`Failed to read the document file: ${describe(error)}`);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.config.S3_BUCKET, Key: key })
      );
    } catch (error) {
      if (isNotFound(error)) {
        return;
      }
      throw new UpstreamError(
        `Failed to delete the document file: ${describe(error)}`
      );
    }
  }

  async get(key: string): Promise<RetrievedFile | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.config.S3_BUCKET, Key: key })
      );
      if (!response.Body) {
        return null;
      }
      const body = Buffer.from(
        await response.Body.transformToByteArray()
      );
      return {
        body,
        contentType: response.ContentType ?? "application/octet-stream"
      };
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }
      throw new UpstreamError(
        `Failed to read the document file: ${describe(error)}`
      );
    }
  }

  async getStream(key: string): Promise<RetrievedFileStream | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.config.S3_BUCKET, Key: key })
      );
      if (!response.Body) {
        return null;
      }
      return {
        body: response.Body as Readable,
        contentType: response.ContentType ?? "application/octet-stream",
        contentLength: response.ContentLength,
        eTag: response.ETag
      };
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }
      throw new UpstreamError(
        `Failed to read the document file: ${describe(error)}`
      );
    }
  }
}

function isNotFound(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const name = (error as { name?: string }).name;
  const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
    ?.httpStatusCode;
  return name === "NoSuchKey" || name === "NotFound" || status === 404;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
