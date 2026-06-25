import type { Request, Response } from "express";
import type { StreamEvent } from "@/application/dto/stream-event";
import type { StreamChatUseCase } from "@/application/use-cases/chat/stream-chat.use-case";

export class ChatController {
  constructor(private readonly streamChat: StreamChatUseCase) { }

  stream = async (req: Request, res: Response): Promise<void> => {
    const controller = new AbortController();
    req.on("close", () => controller.abort());

    const input = { ...req.body, userId: req.auth!.userId };
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

function serializeEvent(event: StreamEvent): string {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
}
