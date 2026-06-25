import type { Reference } from "@/domain/entities/chat";

export type StreamEvent =
  | { event: "meta"; data: { reference: Reference | null } }
  | { event: "delta"; data: { text: string } }
  | { event: "question"; data: { text: string } }
  | { event: "done"; data: Record<string, never> }
  | { event: "error"; data: { error: string } };
