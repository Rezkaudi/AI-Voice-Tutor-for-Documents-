import type { SpeechLanguage } from "@/types";

/** View preferences, transient error, and the pending tutor question. */
export interface UiSlice {
  error: string | null;
  speechLanguage: SpeechLanguage;
  showTranscript: boolean;
  showCaption: boolean;
  pendingQuestion: string | null;
  setError: (error: string | null) => void;
  setPendingQuestion: (question: string | null) => void;
  dismissQuestion: () => void;
  toggleTranscript: () => void;
  setTranscript: (open: boolean) => void;
  toggleCaption: () => void;
  setSpeechLanguage: (speechLanguage: SpeechLanguage) => void;
}

/** Voice-call lifecycle: mic, page selection, and call start/stop. */
export interface CallSlice {
  callMode: boolean;
  hasIntroduced: boolean;
  selectedPages: number[];
  pageDialogOpen: boolean;
  preparingPages: boolean;
  prepareError: string | null;
  teacherAsks: boolean;
  silentRounds: number;
  awaitingPresence: boolean;
  toggleTeacherAsks: () => void;
  handleVoiceTranscript: (transcript: string) => void;
  maybeContinueCall: () => void;
  handleMicToggle: () => void;
  endCall: () => void;
  handleCallToggle: () => Promise<void>;
  openPageDialog: () => void;
  closePageDialog: () => void;
  submitPageSelection: (pages: number[]) => Promise<void>;
  retryPreparePages: () => Promise<void>;
  cancelPreparePages: () => void;
}

/** Document-session lifecycle: reset, upload, switch, and close. */
export interface DocumentSessionSlice {
  clearChat: () => void;
  handleUpload: (file: File | null) => Promise<string | null>;
  handleSwitchDocument: (documentId: string) => Promise<void>;
  closeDocument: () => void;
}

export type SessionStore = UiSlice & CallSlice & DocumentSessionSlice;
