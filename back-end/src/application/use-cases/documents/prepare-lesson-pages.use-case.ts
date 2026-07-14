import { NotFoundError } from "@/domain/errors/app-error";
import type { DocumentRepository } from "@/domain/repositories/document-repository";
import type { Logger } from "@/domain/services/logger";
import { MAX_LESSON_PAGES } from "@/config/constant.config";
import type { LoadLessonPagesUseCase } from "./load-lesson-pages.use-case";

export interface PrepareLessonPagesInput {
  readonly userId: string;
  readonly documentId: string;
  readonly pageNumbers: number[];
}

export class PrepareLessonPagesUseCase {
  constructor(
    private readonly repository: DocumentRepository,
    private readonly loadLessonPages: LoadLessonPagesUseCase,
    private readonly logger: Logger
  ) { }

  async execute(input: PrepareLessonPagesInput): Promise<{ pages: number[] }> {
    const log = this.logger.scope("pages");
    const document = await this.repository.findById(input.documentId, input.userId);
    if (!document) {
      log.warn(`document ${input.documentId} not found`);
      throw new NotFoundError("Document not found.");
    }

    const selectedPages = Array.from(new Set(input.pageNumbers))
      .filter((pageNumber) => pageNumber >= 1 && pageNumber <= document.pageCount)
      .sort((a, b) => a - b)
      .slice(0, MAX_LESSON_PAGES);

    log.info(
      `user ${input.userId} · document ${input.documentId} · ` +
      `preparing lesson pages [${selectedPages.join(", ")}]`
    );

    const pages = await this.loadLessonPages.execute({
      userId: input.userId,
      documentId: input.documentId,
      storagePath: document.storagePath,
      pageNumbers: selectedPages
    });

    return { pages: pages.map((page) => page.pageNumber) };
  }
}
