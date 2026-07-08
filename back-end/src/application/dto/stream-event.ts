import type { Reference } from "@/domain/entities/chat";

export type StreamEvent =
  | { event: "meta"; data: { reference: Reference | null } }
  | { event: "delta"; data: { text: string } }
  | { event: "question"; data: { text: string } }
  | { event: "speech-start"; data: { id: number; text: string; markers: number[] } }
  | { event: "speech-chunk"; data: { id: number; audio: string } }
  | { event: "speech-end"; data: { id: number } }
  | { event: "done"; data: Record<string, never> }
  | { event: "error"; data: { error: string } };
