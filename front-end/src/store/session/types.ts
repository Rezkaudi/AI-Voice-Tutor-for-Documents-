import type { MobilePane, SpeechLanguage } from "@/types";

/** View preferences, transient error, and the pending tutor question. */
export interface UiSlice {
  error: string | null;
  mobilePane: MobilePane;
  speechLanguage: SpeechLanguage;
  saveCost: boolean;
  showTranscript: boolean;
  showCaption: boolean;
  pendingQuestion: string | null;
  setError: (error: string | null) => void;
  setPendingQuestion: (question: string | null) => void;
  dismissQuestion: () => void;
  toggleTranscript: () => void;
  setTranscript: (open: boolean) => void;
  toggleCaption: () => void;
  setMobilePane: (mobilePane: MobilePane) => void;
  setSpeechLanguage: (speechLanguage: SpeechLanguage) => void;
  initSaveCost: () => void;
  toggleSaveCost: () => void;
}

/** Voice-call lifecycle: mic, page selection, and call start/stop. */
export interface CallSlice {
  callMode: boolean;
  hasIntroduced: boolean;
  selectedPages: number[];
  pageDialogOpen: boolean;
  preparingPages: boolean;
  prepareError: string | null;
  handleVoiceTranscript: (transcript: string) => void;
  maybeContinueCall: () => void;
  handleMicToggle: () => void;
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
