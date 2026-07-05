import type { StreamEvent } from "@/application/dto/stream-event";
import type { ChatMessage } from "@/domain/entities/chat";
import { NotFoundError, ValidationError } from "@/domain/errors/app-error";
import type { ChatHistorySanitizer } from "@/domain/logic/chat-history-sanitizer";
import type { DocumentRepository } from "@/domain/repositories/document-repository";
import type { TutorService } from "@/domain/services/tutor-service";
import type { Logger } from "@/domain/services/logger";
import type { CostTracker } from "@/application/services/cost-tracker";
import type { LoadLessonPagesUseCase } from "@/application/use-cases/documents/load-lesson-pages.use-case";
import { MAX_LESSON_PAGES } from "@/config/constant.config";

export interface StreamChatInput {
  readonly userId: string;
  readonly documentId: string;
  readonly message: string;
  readonly language: string;
  readonly messages: ChatMessage[];
  readonly selectedPages: number[];
  readonly saveCost: boolean;
}

export class StreamChatUseCase {
  constructor(
    private readonly repository: DocumentRepository,
    private readonly tutor: TutorService,
    private readonly historySanitizer: ChatHistorySanitizer,
    private readonly loadLessonPages: LoadLessonPagesUseCase,
    private readonly costTracker: CostTracker,
    private readonly logger: Logger
  ) { }

  async execute(input: StreamChatInput, signal: AbortSignal): Promise<AsyncIterable<StreamEvent>> {

    const log = this.logger.scope("chat");
    const documentId = input.documentId.trim();
    const message = input.message.trim();
    if (!documentId || !message) {
      log.warn("rejected — document and message are required");
      throw new ValidationError("Document and message are required.");
    }

    log.info(
      `question on document ${documentId} · lang=${input.language} · ` +
      `saveCost=${input.saveCost} · history=${input.messages.length} msg(s)`
    );
    log.detail("student message", message);

    const document = await this.repository.findById(documentId, input.userId);
    if (!document) {
      log.warn(`document ${documentId} not found`);
      throw new NotFoundError("Document not found.");
    }

    const history = this.historySanitizer.sanitize(input.messages);

    const selectedPages = Array.from(new Set(input.selectedPages))
      .filter((pageNumber) => pageNumber >= 1 && pageNumber <= document.pageCount)
      .sort((a, b) => a - b)
      .slice(0, MAX_LESSON_PAGES);

    const pages = await this.loadLessonPages.execute({
      userId: input.userId,
      documentId,
      storagePath: document.storagePath,
      pageNumbers: selectedPages
    });

    const chunks: never[] = [];

    log.info(
      `loaded document "${document.title}" · ${pages.length} lesson page(s) · ` +
      `chunks disabled · ${history.length} history turn(s) · ` +
      `lesson pages=[${selectedPages.join(", ")}] → streaming answer`
    );

    if (selectedPages.length > 0) {
      const byNumber = new Map(pages.map((page) => [page.pageNumber, page]));
      for (const pageNumber of selectedPages) {
        const page = byNumber.get(pageNumber);
        log.detail(`selected page ${pageNumber} content`, page?.text ?? "");
      }
    }

    const tutor = this.tutor;
    const costTracker = this.costTracker;
    const userId = input.userId;

    return (async function* stream(): AsyncGenerator<StreamEvent> {
      yield { event: "meta", data: { reference: null } };

      let deltaCount = 0;
      try {
        for await (const event of tutor.streamReply(
          {
            document,
            message,
            language: input.language,
            history,
            pages,
            chunks,
            selectedPages,
            saveCost: input.saveCost
          },
          signal
        )) {
          if (event.type === "reference") {
            log.info(`emitting citation → page ${event.reference.pageNumber}`);
            console.log(`[reference] ${JSON.stringify(event.reference)}`);
            yield { event: "meta", data: { reference: event.reference } };
          } else if (event.type === "question") {
            yield { event: "question", data: { text: event.text } };
          } else if (event.type === "usage") {
            await costTracker.track(userId, event.usage, { countAsQuestion: true });
          } else {
            deltaCount += 1;
            console.log(`[text] ${event.text}`);
            yield { event: "delta", data: { text: event.text } };
          }
        }
        log.info(`answer complete · ${deltaCount} delta(s) streamed`);
        yield { event: "done", data: {} };
      } catch (error) {
        if (signal.aborted) {
          log.info("learner aborted mid-answer — closing stream quietly");
          return;
        }
        const reason =
          error instanceof Error
            ? error.message
            : "The teacher could not answer right now.";
        log.error(`answer failed — ${reason}`);
        yield { event: "error", data: { error: reason } };
      }
    })();
  }
}
