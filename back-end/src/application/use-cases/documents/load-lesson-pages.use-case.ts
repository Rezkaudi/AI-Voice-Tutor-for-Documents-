import type { DocumentPage } from "@/domain/entities/document";
import { NotFoundError } from "@/domain/errors/app-error";
import type { DocumentTextExtractor } from "@/domain/services/document-text-extractor";
import type { FileStorage } from "@/domain/services/file-storage";
import type { PageCache } from "@/domain/services/page-cache";
import type { Logger } from "@/domain/services/logger";

export interface LoadLessonPagesInput {
  readonly userId: string;
  readonly documentId: string;
  readonly storagePath: string;
  readonly pageNumbers: number[];
}

export class LoadLessonPagesUseCase {
  constructor(
    private readonly storage: FileStorage,
    private readonly extractor: DocumentTextExtractor,
    private readonly cache: PageCache,
    private readonly logger: Logger
  ) { }

  async execute(input: LoadLessonPagesInput): Promise<DocumentPage[]> {
    const log = this.logger.scope("pages");
    const { userId, documentId } = input;
    const requested = Array.from(new Set(input.pageNumbers))
      .filter((pageNumber) => Number.isInteger(pageNumber) && pageNumber >= 1)
      .sort((a, b) => a - b);
    if (requested.length === 0) {
      await this.cache.retain(userId, documentId, []);
      return [];
    }

    const pages = new Map<number, string>();
    const missing: number[] = [];
    for (const pageNumber of requested) {
      const cached = await this.cache.get(userId, documentId, pageNumber);
      if (cached === undefined) {
        missing.push(pageNumber);
      } else {
        pages.set(pageNumber, cached);
      }
    }

    if (missing.length > 0) {
      log.info(
        `user ${userId} · document ${documentId} · extracting [${missing.join(", ")}] · ` +
        `cached [${requested.filter((page) => pages.has(page)).join(", ")}]`
      );
      const file = await this.storage.get(input.storagePath);
      if (!file) {
        throw new NotFoundError("The document file could not be found.");
      }
      for (const page of await this.extractor.extractPages(file.body, missing)) {
        await this.cache.set(userId, documentId, page.pageNumber, page.text);
        pages.set(page.pageNumber, page.text);
      }
    } else {
      log.info(`user ${userId} · document ${documentId} · all pages cached [${requested.join(", ")}]`);
    }

    await this.cache.retain(userId, documentId, requested);

    return requested
      .filter((pageNumber) => pages.has(pageNumber))
      .map((pageNumber) => ({ documentId, pageNumber, text: pages.get(pageNumber)! }));
  }
}
