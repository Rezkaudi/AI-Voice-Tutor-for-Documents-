import type { Reference } from "./types";

export type StreamEvent =
  | { event: "meta"; data: { reference: Reference | null } }
  | { event: "delta"; data: { text: string } }
  | { event: "done"; data: Record<string, never> }
  | { event: "error"; data: { error: string } };

/**
 * Read a `text/event-stream` body and invoke `onEvent` for every complete
 * `event: …\ndata: …` frame as it arrives.
 */
export async function readEventStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: StreamEvent) => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const event = parseStreamEvent(part);
      if (event) {
        onEvent(event);
      }
    }
  }
}

/**
 * Parse a single SSE frame. Returns `null` for incomplete or malformed frames
 * so a corrupt chunk never aborts an otherwise healthy stream.
 */
export function parseStreamEvent(part: string): StreamEvent | null {
  const lines = part.split("\n");
  const eventLine = lines.find((line) => line.startsWith("event: "));
  const dataLine = lines.find((line) => line.startsWith("data: "));

  if (!eventLine || !dataLine) {
    return null;
  }

  try {
    return {
      event: eventLine.replace("event: ", "") as StreamEvent["event"],
      data: JSON.parse(dataLine.replace("data: ", ""))
    } as StreamEvent;
  } catch {
    return null;
  }
}
