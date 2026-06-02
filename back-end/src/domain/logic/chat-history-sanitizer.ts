import type { ChatMessage } from "@/domain/entities/chat";

/**
 * Trims a conversation history down to what is safe to send to the tutor.
 *
 * Encapsulates the chat-context policy: drop empty or non-conversational
 * turns, keep only the most recent ones, and cap each message's length. Pure —
 * it inspects the messages only, never the document or the model.
 */
export class ChatHistorySanitizer {
  /** Keep at most this many recent history turns. */
  static readonly HISTORY_LIMIT = 10;
  /** Truncate each message to this many characters. */
  static readonly MESSAGE_CHAR_LIMIT = 4000;

  /** Keeps the most recent valid turns, each truncated to a safe length. */
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
