export interface StoredFileInput {
  readonly key: string;
  readonly body: Buffer;
  readonly contentType: string;
}

export interface RetrievedFile {
  readonly body: Buffer;
  readonly contentType: string;
}

export interface FileStorage {
  put(input: StoredFileInput): Promise<void>;
  get(key: string): Promise<RetrievedFile | null>;
  delete(key: string): Promise<void>;
}
