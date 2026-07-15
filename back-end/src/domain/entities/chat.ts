export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface Citation {
  pageNumber: number;
  start: number;
  end: number;
  quote: string;
}

export interface Reference {
  pageNumber: number;
  citations: Citation[];
}
