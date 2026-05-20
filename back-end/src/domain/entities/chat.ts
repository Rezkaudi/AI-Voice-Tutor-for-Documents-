/**
 * Conversation entities for the tutor chat.
 */

/** Roles in a tutor conversation. */
export type ChatRole = "user" | "assistant";

/** One turn of the tutor conversation. */
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** Languages the tutor's reply can be pinned to. `""` means auto-detect. */
export type SpeechLanguage = "ja" | "en" | "ar" | "";

/**
 * A citation pointing the learner at the page the tutor is drawing from.
 * Mirrors the front-end `DocumentReference` shape (plus an optional chunk id).
 */
export interface Reference {
  pageNumber: number;
  snippet: string;
  chunkId?: string;
}
