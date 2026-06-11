import type { Request, Response } from "express";
import type { StreamEvent } from "@/application/dto/stream-event";
import type { StreamChatUseCase } from "@/application/use-cases/chat/stream-chat.use-case";

/**
 * HTTP adapter for the streaming tutor chat (`/api/chat`).
 *
 * Document existence and tutor availability are checked *before* the SSE
 * response is opened, so those failures arrive as ordinary JSON errors. Once
 * the stream is open, every event — including errors — is an SSE frame.
 */
export class ChatController {
  constructor(private readonly streamChat: StreamChatUseCase) {}

  stream = async (req: Request, res: Response): Promise<void> => {
    // Bridge the client disconnecting (fetch abort / call ended) to the tutor.
    const controller = new AbortController();
    req.on("close", () => controller.abort());

    // Identity comes from the verified session, never the request body.
    const input = { ...req.body, userId: req.auth!.userId };
    // May throw (404 / 501) — handled as JSON before any SSE byte is written.
    const events = await this.streamChat.execute(input, controller.signal);

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });

    for await (const event of events) {
      if (controller.signal.aborted) {
        break;
      }
      res.write(serializeEvent(event));
    }
    res.end();
  };
}

/** Serialises a domain event into a `text/event-stream` frame. */
function serializeEvent(event: StreamEvent): string {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
}
