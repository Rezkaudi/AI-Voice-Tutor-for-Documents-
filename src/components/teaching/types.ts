import type { ChatMessage, DocumentPage, DocumentRecord, Reference } from "@/lib/types";

export type AccessState = "checking" | "locked" | "granted";

export type UploadState = "idle" | "processing";

export type MobilePane = "document" | "teacher";

export type LoadedDocument = {
  document: DocumentRecord;
  pages: DocumentPage[];
  fileUrl: string | null;
};

export type UiMessage = ChatMessage & {
  id: string;
  reference?: Reference | null;
  hidden?: boolean;
};

export const SPEECH_LANGUAGES: { value: string; label: string }[] = [
  { value: "ja", label: "Japanese" },
  { value: "en", label: "English" },
  { value: "ar", label: "Arabic" },
  { value: "", label: "Auto" }
];

/** Hidden prompt that asks the tutor to open the lesson with a spoken greeting. */
export const GREETING_PROMPT =
  "Greet the student warmly in 2-3 short sentences. Introduce yourself as their AI teacher " +
  "for this document. Briefly list what you can do: summarize sections, explain concepts in " +
  "plain language, quiz them, and answer any question grounded in the document. End by asking " +
  "what they'd like to start with. Do not include citations or page numbers in this greeting.";
