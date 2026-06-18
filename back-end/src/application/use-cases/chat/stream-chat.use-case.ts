import type { StreamEvent } from "@/application/dto/stream-event";
import type { ChatMessage } from "@/domain/entities/chat";
import { NotFoundError, ValidationError } from "@/domain/errors/app-error";
import type { ChatHistorySanitizer } from "@/domain/logic/chat-history-sanitizer";
import type { DocumentRepository } from "@/domain/repositories/document-repository";
import type { TutorService } from "@/domain/services/tutor-service";
import type { Logger } from "@/domain/services/logger";
import type { CostTracker } from "@/application/services/cost-tracker";
import { MAX_LESSON_PAGES } from "@/config/constant.config";

/** The chat request payload, mirroring the front-end `ChatPayload`. */
export interface StreamChatInput {
  /** The signed-in user; the document must belong to them. */
  readonly userId: string;
  readonly documentId: string;
  readonly message: string;
  readonly language: string;
  readonly messages: ChatMessage[];
  /** 1-based page numbers the student chose to study this call (max 5). */
  readonly selectedPages: number[];
  readonly saveCost: boolean;
}

/**
 * Streams a tutor answer for a learner's message.
 *
 * `execute` validates the request and loads the document *before* returning
 * the event stream — so a missing document surfaces as a JSON 404, never a
 * half-open SSE response. The returned iterable then yields the SSE events:
 * an initial `meta`, the tutor's `meta`/`delta`s, and a final `done`.
 */
export class StreamChatUseCase {
  constructor(
    private readonly repository: DocumentRepository,
    private readonly tutor: TutorService,
    private readonly historySanitizer: ChatHistorySanitizer,
    private readonly costTracker: CostTracker,
    private readonly logger: Logger
  ) {}

  async execute(
    input: StreamChatInput,
    signal: AbortSignal
  ): Promise<AsyncIterable<StreamEvent>> {
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

    const pages = await this.repository.getPages(documentId);

    const history = this.historySanitizer.sanitize(input.messages);

    // Keep only real, in-range page numbers, de-duplicated, ordered, capped at
    // MAX_LESSON_PAGES — the UI enforces this too, but never trust the wire.
    const validPages = new Set(pages.map((page) => page.pageNumber));
    const selectedPages = Array.from(new Set(input.selectedPages))
      .filter((pageNumber) => validPages.has(pageNumber))
      .sort((a, b) => a - b)
      .slice(0, MAX_LESSON_PAGES);

    // ─── CHUNKS DISABLED ─────────────────────────────────────────────────────
    // Chunking + embedding are turned off at upload time, so there are no chunk
    // rows to read and the tutor teaches only the selected pages (full page text
    // injected directly). We always run with an empty chunk list. Re-enable the
    // upload chunking/embedding blocks AND the conditional load below together to
    // restore whole-document retrieval.
    // const chunks =
    //   selectedPages.length > 0 ? [] : await this.repository.getChunks(documentId);
    const chunks: never[] = [];

    log.info(
      `loaded document "${document.title}" · ${pages.length} page(s) · ` +
        `chunks disabled · ${history.length} history turn(s) · ` +
        `lesson pages=[${selectedPages.join(", ")}] → streaming answer`
    );

    // Log the verbatim text of the pages the student chose to study, so the
    // exact material handed to the tutor is visible in the logs.
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
            yield { event: "meta", data: { reference: event.reference } };
          } else if (event.type === "usage") {
            // Bill the turn against the user — best-effort, never streamed out.
            await costTracker.track(userId, event.usage, { countAsQuestion: true });
          } else {
            deltaCount += 1;
            yield { event: "delta", data: { text: event.text } };
          }
        }
        log.info(`answer complete · ${deltaCount} delta(s) streamed`);
        yield { event: "done", data: {} };
      } catch (error) {
        if (signal.aborted) {
          // The learner ended the call mid-answer — close quietly.
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
