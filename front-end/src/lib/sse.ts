import type { StreamEvent } from "@/types";

export async function readEventStream<E extends { event: string; data: unknown } = StreamEvent>(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: E) => void
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
      const event = parseStreamEvent<E>(part);
      if (event) {
        onEvent(event);
      }
    }
  }
}

export function parseStreamEvent<E extends { event: string; data: unknown } = StreamEvent>(
  part: string
): E | null {
  const lines = part.split("\n");
  const eventLine = lines.find((line) => line.startsWith("event: "));
  const dataLine = lines.find((line) => line.startsWith("data: "));

  if (!eventLine || !dataLine) {
    return null;
  }

  try {
    return {
      event: eventLine.replace("event: ", ""),
      data: JSON.parse(dataLine.replace("data: ", ""))
    } as E;
  } catch {
    return null;
  }
}
