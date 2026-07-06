import type { Readable } from "node:stream";

export interface StoredFileInput {
  readonly key: string;
  readonly body: Buffer;
  readonly contentType: string;
}

export interface RetrievedFile {
  readonly body: Buffer;
  readonly contentType: string;
}

export interface RetrievedFileStream {
  readonly body: Readable;
  readonly contentType: string;
  readonly contentLength?: number;
  readonly eTag?: string;
}

export interface StoredFileMetadata {
  readonly size: number;
  readonly contentType: string;
}

export interface FileStorage {
  put(input: StoredFileInput): Promise<void>;
  get(key: string): Promise<RetrievedFile | null>;
  getStream(key: string): Promise<RetrievedFileStream | null>;
  delete(key: string): Promise<void>;
  presignPut(key: string, contentType: string, expiresInSeconds?: number): Promise<string>;
  head(key: string): Promise<StoredFileMetadata | null>;
}
