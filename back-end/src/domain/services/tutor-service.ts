import type {
  DocumentChunk,
  DocumentPage,
  DocumentRecord
} from "@/domain/entities/document";
import type { ChatMessage, Reference } from "@/domain/entities/chat";
import type { AiUsage } from "@/domain/services/ai-usage";

export type TutorStreamEvent =
  | { type: "delta"; text: string }
  | { type: "reference"; reference: Reference }
  | { type: "question"; text: string }
  | { type: "usage"; usage: AiUsage };

/** Everything the tutor needs to compose a streamed reply. */
export interface TutorReplyRequest {
  readonly document: DocumentRecord;
  readonly message: string;
  readonly language: string;
  readonly history: ReadonlyArray<ChatMessage>;
  /** Every page — the tutor reads them on demand via its tools. */
  readonly pages: DocumentPage[];
  /** Every chunk — searched by the `search_document` tool. */
  readonly chunks: DocumentChunk[];
  /**
   * The 1-based page numbers the student chose to study this call (max 5).
   * When non-empty, their full text is injected as lesson material and the
   * tutor teaches them in order, page by page. Empty means "the whole document".
   */
  readonly selectedPages: number[];
  /** When true, use the cheaper model and a smaller history window. */
  readonly saveCost: boolean;
}

/**
 * The AI tutor boundary.
 *
 * Implementations stream the reply, reading the document agentically through
 * tools. When no AI provider is configured the implementation still streams a
 * local demo answer, so the app stays usable without an API key.
 */
export interface TutorService {
  /** Streams the tutor's reply as ordered text/reference events. */
  streamReply(
    request: TutorReplyRequest,
    signal: AbortSignal
  ): AsyncGenerator<TutorStreamEvent>;
}
