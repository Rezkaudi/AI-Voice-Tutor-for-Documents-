import type { StreamEvent } from "@/application/dto/stream-event";
import type { ChatMessage } from "@/domain/entities/chat";
import { NotFoundError, ValidationError } from "@/domain/errors/app-error";
import type { ChatHistorySanitizer } from "@/domain/logic/chat-history-sanitizer";
import { SentenceStreamSegmenter } from "@/domain/logic/speech/sentence-stream-segmenter";
import type { DocumentRepository } from "@/domain/repositories/document-repository";
import type { SpeechSynthesisService } from "@/domain/services/speech-services";
import type { TutorService } from "@/domain/services/tutor-service";
import type { Logger } from "@/domain/services/logger";
import type { CostTracker } from "@/application/services/cost-tracker";
import { AsyncEventQueue } from "@/application/services/async-event-queue";
import { ReplySpeechStreamer } from "@/application/services/reply-speech-streamer";
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
    private readonly speech: SpeechSynthesisService,
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
    const speech = this.speech;
    const costTracker = this.costTracker;
    const userId = input.userId;

    return (async function* stream(): AsyncGenerator<StreamEvent> {
      yield { event: "meta", data: { reference: null } };

      // Tutor deltas and synthesized audio are produced concurrently and
      // interleaved through one queue: text is never delayed by synthesis,
      // and each sentence's audio starts the moment the sentence completes.
      const queue = new AsyncEventQueue<StreamEvent>();
      const segmenter = new SentenceStreamSegmenter();
      const speaker = new ReplySpeechStreamer(
        speech,
        (event) => queue.push(event),
        signal,
        log
      );

      const producing = (async () => {
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
              queue.push({ event: "meta", data: { reference: event.reference } });
            } else if (event.type === "question") {
              queue.push({ event: "question", data: { text: event.text } });
            } else if (event.type === "usage") {
              await costTracker.track(userId, event.usage, { countAsQuestion: true });
            } else {
              deltaCount += 1;
              queue.push({ event: "delta", data: { text: event.text } });
              for (const sentence of segmenter.push(event.text)) {
                speaker.speak(sentence);
              }
            }
          }

          const tail = segmenter.flush();
          if (tail) speaker.speak(tail);

          const ttsUsage = await speaker.finish();
          if (ttsUsage) await costTracker.track(userId, ttsUsage);

          log.info(`answer complete · ${deltaCount} delta(s) streamed`);
          queue.push({ event: "done", data: {} });
          queue.end();
        } catch (error) {
          if (signal.aborted) {
            log.info("learner aborted mid-answer — closing stream quietly");
            queue.end();
            return;
          }
          const reason =
            error instanceof Error
              ? error.message
              : "The teacher could not answer right now.";
          log.error(`answer failed — ${reason}`);
          queue.push({ event: "error", data: { error: reason } });
          queue.end();
        }
      })();

      for await (const event of queue) {
        yield event;
      }
      await producing;
    })();
  }
}
