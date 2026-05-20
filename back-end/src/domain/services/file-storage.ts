/**
 * Object-storage boundary (S3 / S3-compatible). Original document files are
 * stored and fetched through this port without the application knowing the
 * concrete provider.
 */

/** A binary object to persist in storage. */
export interface StoredFileInput {
  /** Storage key (path) the object will live under. */
  readonly key: string;
  readonly body: Buffer;
  readonly contentType: string;
}

/** A binary object retrieved from storage. */
export interface RetrievedFile {
  readonly body: Buffer;
  readonly contentType: string;
}

export interface FileStorage {
  /** Uploads an object; resolves once it is durably stored. */
  put(input: StoredFileInput): Promise<void>;

  /** Fetches an object, or `null` when the key does not exist. */
  get(key: string): Promise<RetrievedFile | null>;

  /** Deletes an object. A no-op when the key does not exist. */
  delete(key: string): Promise<void>;
}
