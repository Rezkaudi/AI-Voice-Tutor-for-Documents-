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
