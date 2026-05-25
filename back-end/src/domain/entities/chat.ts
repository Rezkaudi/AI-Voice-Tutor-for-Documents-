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
/**
 * One verbatim passage the tutor's answer is grounded in. `start`/`end` are
 * character offsets into that page's extracted text — the front-end maps them
 * onto the PDF.js text layer to draw a NotebookLM-style highlight.
 */
export interface Citation {
  pageNumber: number;
  start: number;
  end: number;
  quote: string;
}

/**
 * A citation pointing the learner at the page the tutor is drawing from. The
 * UI jumps to `pageNumber` and lights up every span listed in `citations`.
 */
export interface Reference {
  pageNumber: number;
  chunkId?: string;
  citations: Citation[];
}
