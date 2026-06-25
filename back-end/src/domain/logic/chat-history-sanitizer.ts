import type { ChatMessage } from "@/domain/entities/chat";

export class ChatHistorySanitizer {
  static readonly HISTORY_LIMIT = 10;
  static readonly MESSAGE_CHAR_LIMIT = 4000;

  sanitize(messages: ChatMessage[]): ChatMessage[] {
    return messages
      .filter(
        (message) =>
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string" &&
          message.content.trim().length > 0
      )
      .slice(-ChatHistorySanitizer.HISTORY_LIMIT)
      .map((message) => ({
        role: message.role,
        content: message.content.slice(
          0,
          ChatHistorySanitizer.MESSAGE_CHAR_LIMIT
        )
      }));
  }
}
