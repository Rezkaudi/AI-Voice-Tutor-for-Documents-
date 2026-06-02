import type { StreamEvent } from "@/application/dto/stream-event";
import type { ChatMessage } from "@/domain/entities/chat";
import { NotFoundError, ValidationError } from "@/domain/errors/app-error";
import type { ChatHistorySanitizer } from "@/domain/logic/chat-history-sanitizer";
import type { DocumentRepository } from "@/domain/repositories/document-repository";
import type { TutorService } from "@/domain/services/tutor-service";

/** The chat request payload, mirroring the front-end `ChatPayload`. */
export interface StreamChatInput {
  readonly documentId: string;
  readonly message: string;
  readonly language: string;
  readonly messages: ChatMessage[];
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
    private readonly historySanitizer: ChatHistorySanitizer
  ) {}

  async execute(
    input: StreamChatInput,
    signal: AbortSignal
  ): Promise<AsyncIterable<StreamEvent>> {
    const documentId = input.documentId.trim();
    const message = input.message.trim();
    if (!documentId || !message) {
      throw new ValidationError("Document and message are required.");
    }

    const document = await this.repository.findById(documentId);
    if (!document) {
      throw new NotFoundError("Document not found.");
    }

    // The tutor reads the document agentically via tools, so hand it
    // everything: every page (get_page / get_outline) and every chunk
    // (search_document).
    const [pages, chunks] = await Promise.all([
      this.repository.getPages(documentId),
      this.repository.getChunks(documentId)
    ]);

    const history = this.historySanitizer.sanitize(input.messages);
    const tutor = this.tutor;

    return (async function* stream(): AsyncGenerator<StreamEvent> {
      yield { event: "meta", data: { reference: null } };

      try {
        for await (const event of tutor.streamReply(
          {
            document,
            message,
            language: input.language,
            history,
            pages,
            chunks,
            saveCost: input.saveCost
          },
          signal
        )) {
          if (event.type === "reference") {
            yield { event: "meta", data: { reference: event.reference } };
          } else {
            yield { event: "delta", data: { text: event.text } };
          }
        }
        yield { event: "done", data: {} };
      } catch (error) {
        if (signal.aborted) {
          // The learner ended the call mid-answer — close quietly.
          return;
        }
        const reason =
          error instanceof Error
            ? error.message
            : "The teacher could not answer right now.";
        yield { event: "error", data: { error: reason } };
      }
    })();
  }
}
