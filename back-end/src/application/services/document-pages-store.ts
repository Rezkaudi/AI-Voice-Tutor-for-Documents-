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
  failed: [],
  attempts: {}
};

export class DocumentPagesStore {
  constructor(
    private readonly storage: FileStorage,
    private readonly logger: Logger,
    private readonly maxPageAttempts: number
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
    const attempts: Record<string, number> = { ...(existing?.attempts ?? {}) };
    for (const page of options?.failedPages ?? []) {
      failed.add(page);
      attempts[String(page)] = (attempts[String(page)] ?? 0) + 1;
    }
    for (const key of Object.keys(pages)) {
      failed.delete(Number(key));
      delete attempts[key];
    }
    const pageCount = existing?.pageCount || options?.pageCount || 0;
    const failedList = Array.from(failed).sort((a, b) => a - b);
    return {
      version: 1,
      pageCount,
      done: this.computeDone(pageCount, pages, failed, attempts),
      pages,
      failed: failedList,
      attempts
    };
  }

  private computeDone(
    pageCount: number,
    pages: Record<string, string>,
    failed: Set<number>,
    attempts: Record<string, number>
  ): boolean {
    if (pageCount < 1) return false;
    for (let page = 1; page <= pageCount; page += 1) {
      const extracted = pages[String(page)] !== undefined;
      const exhausted = failed.has(page) && (attempts[String(page)] ?? 0) >= this.maxPageAttempts;
      if (!extracted && !exhausted) return false;
    }
    return true;
  }

  private parse(body: Buffer): DocumentPagesFile | null {
    try {
      const raw = JSON.parse(body.toString("utf-8")) as Partial<DocumentPagesFile>;
      if (raw.version !== 1 || typeof raw.pages !== "object" || raw.pages === null) {
        return null;
      }
      const pageCount = typeof raw.pageCount === "number" ? raw.pageCount : 0;
      const pages = raw.pages as Record<string, string>;
      const failed = Array.isArray(raw.failed) ? raw.failed : [];
      const attempts =
        typeof raw.attempts === "object" && raw.attempts !== null
          ? (raw.attempts as Record<string, number>)
          : {};
      return {
        version: 1,
        pageCount,
        done: this.computeDone(pageCount, pages, new Set(failed), attempts),
        pages,
        failed,
        attempts
      };
    } catch {
      return null;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
