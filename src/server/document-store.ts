import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { appConfig, getSupabaseConfigIssue, hasSupabaseConfig } from "@/lib/config";
import { safeFileName } from "@/lib/documents";
import type { DocumentChunk, DocumentPage, DocumentRecord, UploadKind } from "@/lib/types";

type SaveDocumentInput = {
  id?: string;
  title: string;
  fileName: string;
  mimeType: string;
  fileType: UploadKind;
  fileSize: number;
  fileBuffer: Buffer;
  pages: DocumentPage[];
  chunks: DocumentChunk[];
};

type StoredFile = {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
};

export type ChunkEmbeddingUpdate = {
  id: string;
  embedding: number[] | null;
};

export type DocumentStore = {
  saveProcessedDocument(input: SaveDocumentInput): Promise<DocumentRecord>;
  updateChunkEmbeddings(documentId: string, updates: ChunkEmbeddingUpdate[]): Promise<void>;
  getDocument(id: string): Promise<DocumentRecord | null>;
  getPages(documentId: string): Promise<DocumentPage[]>;
  getChunks(documentId: string): Promise<DocumentChunk[]>;
  getFile(documentId: string): Promise<StoredFile | null>;
  getFileUrl(documentId: string): Promise<string | null>;
};

let store: DocumentStore | null = null;

export function getDocumentStore(): DocumentStore {
  const supabaseIssue = getSupabaseConfigIssue();
  if (supabaseIssue) {
    throw new Error(supabaseIssue);
  }

  if (!store) {
    store = hasSupabaseConfig() ? new SupabaseDocumentStore() : new LocalDocumentStore();
  }

  return store;
}

class LocalDocumentStore implements DocumentStore {
  private root = path.join(process.cwd(), ".data");
  private indexPath = path.join(this.root, "documents.json");

  async saveProcessedDocument(input: SaveDocumentInput): Promise<DocumentRecord> {
    const id = input.id ?? randomUUID();
    const now = new Date().toISOString();
    const storagePath = path.join("uploads", `${id}-${safeFileName(input.fileName)}`);
    const record: DocumentRecord = {
      id,
      title: input.title,
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileType: input.fileType,
      fileSize: input.fileSize,
      status: "ready",
      pageCount: input.pages.length,
      storagePath,
      createdAt: now,
      updatedAt: now,
      error: null
    };

    await this.ensureDirs();
    await writeFile(path.join(this.root, storagePath), input.fileBuffer);
    await writeFile(this.pagesPath(id), JSON.stringify(withDocumentId(input.pages, id), null, 2));
    await writeFile(this.chunksPath(id), JSON.stringify(withChunkDocumentId(input.chunks, id), null, 2));

    const records = await this.readIndex();
    await writeFile(this.indexPath, JSON.stringify([...records.filter((item) => item.id !== id), record], null, 2));

    return record;
  }

  async updateChunkEmbeddings(documentId: string, updates: ChunkEmbeddingUpdate[]): Promise<void> {
    const embeddingById = new Map(updates.map((update) => [update.id, update.embedding]));
    const chunks = await this.getChunks(documentId);
    const merged = chunks.map((chunk) =>
      embeddingById.has(chunk.id) ? { ...chunk, embedding: embeddingById.get(chunk.id) ?? null } : chunk
    );
    await this.ensureDirs();
    await writeFile(this.chunksPath(documentId), JSON.stringify(merged, null, 2));
  }

  async getDocument(id: string): Promise<DocumentRecord | null> {
    const records = await this.readIndex();
    return records.find((record) => record.id === id) ?? null;
  }

  async getPages(documentId: string): Promise<DocumentPage[]> {
    return readJson<DocumentPage[]>(this.pagesPath(documentId), []);
  }

  async getChunks(documentId: string): Promise<DocumentChunk[]> {
    return readJson<DocumentChunk[]>(this.chunksPath(documentId), []);
  }

  async getFile(documentId: string): Promise<StoredFile | null> {
    const record = await this.getDocument(documentId);
    if (!record) {
      return null;
    }

    try {
      return {
        buffer: await readFile(path.join(this.root, record.storagePath)),
        mimeType: record.mimeType,
        fileName: record.fileName
      };
    } catch {
      return null;
    }
  }

  async getFileUrl(documentId: string): Promise<string | null> {
    return `/api/documents/${documentId}/file`;
  }

  private async ensureDirs(): Promise<void> {
    await mkdir(path.join(this.root, "uploads"), { recursive: true });
    await mkdir(path.join(this.root, "pages"), { recursive: true });
    await mkdir(path.join(this.root, "chunks"), { recursive: true });
  }

  private async readIndex(): Promise<DocumentRecord[]> {
    await this.ensureDirs();
    return readJson<DocumentRecord[]>(this.indexPath, []);
  }

  private pagesPath(documentId: string): string {
    return path.join(this.root, "pages", `${documentId}.json`);
  }

  private chunksPath(documentId: string): string {
    return path.join(this.root, "chunks", `${documentId}.json`);
  }
}

class SupabaseDocumentStore implements DocumentStore {
  private client: SupabaseClient;
  private bucket = appConfig.supabaseStorageBucket;

  constructor() {
    this.client = createClient(appConfig.supabaseUrl, appConfig.supabaseServiceRoleKey, {
      auth: { persistSession: false }
    });
  }

  async saveProcessedDocument(input: SaveDocumentInput): Promise<DocumentRecord> {
    const id = input.id ?? randomUUID();
    const now = new Date().toISOString();
    const storagePath = `${id}/${safeFileName(input.fileName)}`;

    const upload = await this.client.storage.from(this.bucket).upload(storagePath, input.fileBuffer, {
      contentType: input.mimeType,
      upsert: true
    });

    if (upload.error) {
      throw upload.error;
    }

    const row = {
      id,
      title: input.title,
      file_name: input.fileName,
      mime_type: input.mimeType,
      file_type: input.fileType,
      file_size: input.fileSize,
      status: "ready",
      page_count: input.pages.length,
      storage_path: storagePath,
      created_at: now,
      updated_at: now,
      error: null
    };

    const documentInsert = await this.client.from("documents").upsert(row).select().single();
    if (documentInsert.error) {
      throw documentInsert.error;
    }

    const pages = withDocumentId(input.pages, id).map((page) => ({
      id: page.id ?? randomUUID(),
      document_id: id,
      page_number: page.pageNumber,
      text: page.text
    }));
    const chunks = withChunkDocumentId(input.chunks, id).map((chunk) => ({
      id: chunk.id,
      document_id: id,
      page_number: chunk.pageNumber,
      chunk_index: chunk.chunkIndex,
      text: chunk.text,
      snippet: chunk.snippet,
      embedding: chunk.embedding ? vectorLiteral(chunk.embedding) : null
    }));

    const pagesInsert = await this.client.from("document_pages").upsert(pages);
    if (pagesInsert.error) {
      throw pagesInsert.error;
    }

    const chunksInsert = await this.client.from("document_chunks").upsert(chunks);
    if (chunksInsert.error) {
      throw chunksInsert.error;
    }

    return mapDocumentRow(documentInsert.data);
  }

  async updateChunkEmbeddings(documentId: string, updates: ChunkEmbeddingUpdate[]): Promise<void> {
    const withEmbedding = updates.filter((update) => update.embedding && update.embedding.length > 0);

    // Update in small concurrent waves to fill embeddings without flooding the
    // database with one request per chunk all at once.
    for (let index = 0; index < withEmbedding.length; index += 20) {
      const wave = withEmbedding.slice(index, index + 20);
      await Promise.all(
        wave.map((update) =>
          this.client
            .from("document_chunks")
            .update({ embedding: vectorLiteral(update.embedding as number[]) })
            .eq("id", update.id)
            .eq("document_id", documentId)
        )
      );
    }
  }

  async getDocument(id: string): Promise<DocumentRecord | null> {
    const result = await this.client.from("documents").select("*").eq("id", id).maybeSingle();
    if (result.error) {
      throw result.error;
    }

    return result.data ? mapDocumentRow(result.data) : null;
  }

  async getPages(documentId: string): Promise<DocumentPage[]> {
    const result = await this.client
      .from("document_pages")
      .select("*")
      .eq("document_id", documentId)
      .order("page_number", { ascending: true });

    if (result.error) {
      throw result.error;
    }

    return result.data.map((row) => ({
      id: row.id,
      documentId: row.document_id,
      pageNumber: row.page_number,
      text: row.text
    }));
  }

  async getChunks(documentId: string): Promise<DocumentChunk[]> {
    const result = await this.client
      .from("document_chunks")
      .select("*")
      .eq("document_id", documentId)
      .order("chunk_index", { ascending: true });

    if (result.error) {
      throw result.error;
    }

    return result.data.map((row) => ({
      id: row.id,
      documentId: row.document_id,
      pageNumber: row.page_number,
      chunkIndex: row.chunk_index,
      text: row.text,
      snippet: row.snippet,
      embedding: parseEmbedding(row.embedding)
    }));
  }

  async getFile(): Promise<StoredFile | null> {
    return null;
  }

  async getFileUrl(documentId: string): Promise<string | null> {
    const record = await this.getDocument(documentId);
    if (!record) {
      return null;
    }

    const signed = await this.client.storage.from(this.bucket).createSignedUrl(record.storagePath, 60 * 60);
    if (signed.error) {
      throw signed.error;
    }

    return signed.data.signedUrl;
  }
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function withDocumentId(pages: DocumentPage[], documentId: string): DocumentPage[] {
  return pages.map((page) => ({
    ...page,
    id: page.id ?? randomUUID(),
    documentId
  }));
}

function withChunkDocumentId(chunks: DocumentChunk[], documentId: string): DocumentChunk[] {
  return chunks.map((chunk, index) => ({
    ...chunk,
    documentId,
    chunkIndex: index
  }));
}

function mapDocumentRow(row: Record<string, unknown>): DocumentRecord {
  return {
    id: String(row.id),
    title: String(row.title),
    fileName: String(row.file_name),
    mimeType: String(row.mime_type),
    fileType: row.file_type as UploadKind,
    fileSize: Number(row.file_size),
    status: row.status as DocumentRecord["status"],
    pageCount: Number(row.page_count),
    storagePath: String(row.storage_path),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    error: row.error ? String(row.error) : null
  };
}

function vectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

function parseEmbedding(value: unknown): number[] | null {
  if (Array.isArray(value)) {
    return value.map(Number);
  }

  if (typeof value === "string") {
    return value.replace(/^\[|\]$/g, "").split(",").map(Number).filter(Number.isFinite);
  }

  return null;
}
