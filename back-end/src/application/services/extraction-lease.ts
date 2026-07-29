import { PreconditionFailedError } from "@/domain/errors/app-error";
import type { FileStorage } from "@/domain/services/file-storage";
import type { Logger } from "@/domain/services/logger";

const RENEW_ATTEMPTS = 3;

export interface LeaseBody {
  readonly owner: string;
  readonly expiresAt: number;
  readonly activePages: number[];
}

export interface LeaseHandle {
  readonly owner: string;
  renew(activePages?: number[]): Promise<boolean>;
  release(): Promise<void>;
}

export class ExtractionLease {
  constructor(
    private readonly storage: FileStorage,
    private readonly logger: Logger,
    private readonly ttlSeconds: number
  ) { }

  keyFor(userId: string, documentId: string): string {
    return `${userId}/${documentId}/extraction.lock`;
  }

  async activePages(userId: string, documentId: string): Promise<number[]> {
    const current = await this.read(userId, documentId);
    if (!current?.body || current.body.expiresAt < Date.now()) return [];
    return [...current.body.activePages];
  }

  async acquire(
    userId: string,
    documentId: string,
    owner: string
  ): Promise<LeaseHandle | null> {
    const log = this.logger.scope("extraction-lease");
    const key = this.keyFor(userId, documentId);
    const current = await this.read(userId, documentId);

    if (current?.body && current.body.expiresAt >= Date.now()) {
      return null;
    }

    const body: LeaseBody = { owner, expiresAt: this.nextExpiry(), activePages: [] };
    try {
      await this.write(key, body, current ? { ifMatch: current.eTag } : { ifNoneMatch: "*" });
    } catch (error) {
      if (error instanceof PreconditionFailedError) {
        return null;
      }
      throw error;
    }

    if (current) {
      log.info(
        `document ${documentId} · took over a stale lease from ${current.body?.owner ?? "an unreadable lock"}`
      );
    }
    return this.handle(userId, documentId, owner);
  }

  private handle(userId: string, documentId: string, owner: string): LeaseHandle {
    const key = this.keyFor(userId, documentId);
    let queue: Promise<unknown> = Promise.resolve();
    return {
      owner,
      renew: (activePages?: number[]): Promise<boolean> => {
        const next = queue
          .catch(() => undefined)
          .then(() => this.renewOnce(userId, documentId, owner, key, activePages));
        queue = next.catch(() => undefined);
        return next;
      },
      release: async (): Promise<void> => {
        const current = await this.read(userId, documentId);
        if (current?.body?.owner !== owner) return;
        await this.storage.delete(key);
      }
    };
  }

  private async renewOnce(
    userId: string,
    documentId: string,
    owner: string,
    key: string,
    activePages?: number[]
  ): Promise<boolean> {
    for (let attempt = 0; attempt < RENEW_ATTEMPTS; attempt += 1) {
      const current = await this.read(userId, documentId);
      if (current?.body?.owner !== owner) return false;

      const body: LeaseBody = {
        owner,
        expiresAt: this.nextExpiry(),
        activePages: activePages ?? current.body.activePages
      };
      try {
        await this.write(key, body, { ifMatch: current.eTag });
        return true;
      } catch (error) {
        if (!(error instanceof PreconditionFailedError)) throw error;
      }
    }
    return false;
  }

  private nextExpiry(): number {
    return Date.now() + this.ttlSeconds * 1000;
  }

  private async read(
    userId: string,
    documentId: string
  ): Promise<{ body: LeaseBody | null; eTag?: string } | null> {
    const stored = await this.storage.get(this.keyFor(userId, documentId));
    if (!stored) return null;
    return { body: this.parse(stored.body), eTag: stored.eTag };
  }

  private parse(raw: Buffer): LeaseBody | null {
    try {
      const parsed = JSON.parse(raw.toString("utf8")) as Partial<LeaseBody>;
      if (typeof parsed.owner !== "string" || typeof parsed.expiresAt !== "number") return null;
      return {
        owner: parsed.owner,
        expiresAt: parsed.expiresAt,
        activePages: Array.isArray(parsed.activePages) ? parsed.activePages : []
      };
    } catch {
      return null;
    }
  }

  private async write(
    key: string,
    body: LeaseBody,
    guard: { ifMatch?: string; ifNoneMatch?: "*" }
  ): Promise<void> {
    await this.storage.put({
      key,
      body: Buffer.from(JSON.stringify(body), "utf8"),
      contentType: "application/json",
      ifMatch: guard.ifMatch,
      ifNoneMatch: guard.ifNoneMatch
    });
  }
}
