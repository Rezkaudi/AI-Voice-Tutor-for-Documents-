export type UploadState = "idle" | "processing";
export type MobilePane = "document" | "teacher";
export type SpeechLanguage = "ja" | "en" | "ar" | "";
export type MicPermission = "unknown" | PermissionState;
export type MessageRole = "user" | "assistant";
export type CaptionSpeaker = "teacher" | "user";
export type AvatarState = "idle" | "idle-call" | "listening" | "thinking" | "speaking";

export interface SpeechLanguageOption {
  value: SpeechLanguage;
  label: string;
}

export interface DocumentRecord {
  id: string;
  title: string;
  pageCount: number;
  mimeType: string;
  fileName?: string;
  fileType?: "pdf";
  fileSize?: number;
  status?: "ready" | "failed";
  updatedAt?: string;
  createdAt?: string;
}

export type DocumentSummary = DocumentRecord;

export interface DocumentPage {
  pageNumber: number;
  text: string;
}

export interface LoadedDocument {
  document: DocumentRecord;
  pages: DocumentPage[];
  fileUrl: string | null;
}

export interface DocumentCitation {
  pageNumber: number;
  start: number;
  end: number;
  quote: string;
}

export interface DocumentReference {
  pageNumber: number;
  citations: DocumentCitation[];
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  hidden?: boolean;
  reference?: DocumentReference | null;
}

export interface ChatHistoryMessage {
  role: MessageRole;
  content: string;
}

export interface ChatPayload {
  documentId: string;
  message: string;
  language: SpeechLanguage;
  messages: ChatHistoryMessage[];

  selectedPages: number[];
  saveCost: boolean;
}

export type StreamEvent =
  | { event: "meta"; data: { reference: DocumentReference | null } }
  | { event: "delta"; data: { text: string } }
  | { event: "question"; data: { text: string } }
  | { event: "done"; data: Record<string, unknown> }
  | { event: "error"; data: { error: string } };

export interface SegmentedText {
  words: string[];
  offsets: number[];

  styles: number[];

  clean: string;
  spaced: boolean;
  rtl: boolean;
}

export interface SpeechCaption {
  speaker: CaptionSpeaker;
  words: string[];

  styles: number[];
  spoken: number;
  spaced: boolean;
  rtl: boolean;
}

export interface SpeechSession {
  push: (sentence: string, onPlaybackStart?: (durationMs: number) => void) => void;
  finished: () => Promise<void>;
}

export interface CallStatus {
  isSpeaking: boolean;
  isListening: boolean;
  isStreaming: boolean;
  isTranscribing: boolean;
  callMode: boolean;
}

export interface VoiceRecorderState {
  isListening: boolean;
  isUserSpeaking: boolean;
  isTranscribing: boolean;
  isSupported: boolean;
  permission: MicPermission;
}
