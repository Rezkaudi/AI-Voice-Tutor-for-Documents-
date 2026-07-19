import type { DocumentPagesFile } from "@/domain/entities/document-pages";
import { PreconditionFailedError } from "@/domain/errors/app-error";
import type { FileStorage } from "@/domain/services/file-storage";
import type { Logger } from "@/domain/services/logger";

export interface PageEntry {
  readonly pageNumber: number;
  readonly text: string;
}

export interface MergeOptions {
  readonly pageCount?: number;
  readonly failedPages?: number[];
}

const MAX_MERGE_ATTEMPTS = 4;

const EMPTY_FILE: DocumentPagesFile = {
  version: 1,
  pageCount: 0,
  done: false,
  pages: {},
  failed: []
};

export class DocumentPagesStore {
  constructor(
    private readonly storage: FileStorage,
    private readonly logger: Logger
  ) { }

  keyFor(userId: string, documentId: string): string {
    return `${userId}/${documentId}/pages.json`;
  }

  async read(
    userId: string,
    documentId: string
  ): Promise<{ file: DocumentPagesFile; eTag?: string } | null> {
    const stored = await this.storage.get(this.keyFor(userId, documentId));
    if (!stored) return null;
    const file = this.parse(stored.body) ?? EMPTY_FILE;
    return { file, eTag: stored.eTag };
  }

  async mergePages(
    userId: string,
    documentId: string,
    entries: readonly PageEntry[],
    options?: MergeOptions
  ): Promise<DocumentPagesFile> {
    const log = this.logger.scope("pages-store");
    for (let attempt = 1; ; attempt += 1) {
      const current = await this.read(userId, documentId);
      const merged = this.applyMerge(current?.file ?? null, entries, options);
      try {
        await this.storage.put({
          key: this.keyFor(userId, documentId),
          body: Buffer.from(JSON.stringify(merged), "utf-8"),
          contentType: "application/json",
          ...(current?.eTag
            ? { ifMatch: current.eTag }
            : { ifNoneMatch: "*" as const })
        });
        return merged;
      } catch (error) {
        if (error instanceof PreconditionFailedError && attempt < MAX_MERGE_ATTEMPTS) {
          log.info(
            `document ${documentId} · pages.json changed concurrently, retrying merge (attempt ${attempt})`
          );
          await sleep(50 * attempt + Math.floor(Math.random() * 100));
          continue;
        }
        throw error;
      }
    }
  }

  async delete(userId: string, documentId: string): Promise<void> {
    await this.storage.delete(this.keyFor(userId, documentId));
  }

  private applyMerge(
    existing: DocumentPagesFile | null,
    entries: readonly PageEntry[],
    options?: MergeOptions
  ): DocumentPagesFile {
    const pages: Record<string, string> = { ...(existing?.pages ?? {}) };
    for (const entry of entries) {
      if (pages[String(entry.pageNumber)] === undefined) {
        pages[String(entry.pageNumber)] = entry.text;
      }
    }
    const failed = new Set<number>(existing?.failed ?? []);
    for (const page of options?.failedPages ?? []) {
      failed.add(page);
    }
    for (const key of Object.keys(pages)) {
      failed.delete(Number(key));
    }
    const pageCount = existing?.pageCount || options?.pageCount || 0;
    const done =
      pageCount >= 1 &&
      Array.from({ length: pageCount }, (_, i) => i + 1).every(
        (page) => pages[String(page)] !== undefined || failed.has(page)
      );
    return {
      version: 1,
      pageCount,
      done,
      pages,
      failed: Array.from(failed).sort((a, b) => a - b)
    };
  }

  private parse(body: Buffer): DocumentPagesFile | null {
    try {
      const raw = JSON.parse(body.toString("utf-8")) as Partial<DocumentPagesFile>;
      if (raw.version !== 1 || typeof raw.pages !== "object" || raw.pages === null) {
        return null;
      }
      return {
        version: 1,
        pageCount: typeof raw.pageCount === "number" ? raw.pageCount : 0,
        done: raw.done === true,
        pages: raw.pages as Record<string, string>,
        failed: Array.isArray(raw.failed) ? raw.failed : []
      };
    } catch {
      return null;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
