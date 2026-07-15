import type { DocumentPage, DocumentRecord } from "@/domain/entities/document";
import type { ChatMessage, Reference } from "@/domain/entities/chat";
import type { AiUsage } from "@/domain/services/ai-usage";

export type TutorStreamEvent =
  | { type: "delta"; text: string }
  | { type: "reference"; reference: Reference }
  | { type: "question"; text: string }
  | { type: "end" }
  | { type: "usage"; usage: AiUsage };

export interface TutorReplyRequest {
  readonly document: DocumentRecord;
  readonly message: string;
  readonly language: string;
  readonly history: ReadonlyArray<ChatMessage>;
  readonly pages: DocumentPage[];
  readonly selectedPages: number[];
  readonly allowAsking: boolean;
}

export interface TutorService {
  streamReply(request: TutorReplyRequest, signal: AbortSignal): AsyncGenerator<TutorStreamEvent>;
}
