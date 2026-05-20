import type { Reference } from "@/domain/entities/chat";

/**
 * Server-sent events emitted by the chat stream. The discriminated union
 * mirrors the front-end `StreamEvent` type exactly; the HTTP layer serialises
 * each into an `event: <name>\ndata: <json>\n\n` SSE frame.
 */
export type StreamEvent =
  | { event: "meta"; data: { reference: Reference | null } }
  | { event: "delta"; data: { text: string } }
  | { event: "done"; data: Record<string, never> }
  | { event: "error"; data: { error: string } };
