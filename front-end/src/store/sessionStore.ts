import { create } from "zustand";
import { CALL_RESUME_DELAY_MS, GREETING_PROMPT } from "@/lib/constants";
import { useChatStore } from "./chatStore";
import { useDocumentStore } from "./documentStore";
import { useSpeechStore } from "./speechStore";
import { useVoiceStore } from "./voiceStore";
import type { MobilePane, SpeechLanguage } from "@/types";

const SAVE_COST_KEY = "saveCostMode";

interface SessionStore {
  error: string | null;
  callMode: boolean;
  hasIntroduced: boolean;
  mobilePane: MobilePane;
  speechLanguage: SpeechLanguage;
  saveCost: boolean;
  selectedPages: number[];
  pageDialogOpen: boolean;
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
  handleVoiceTranscript: (transcript: string) => void;
  maybeContinueCall: () => void;
  clearChat: () => void;
  handleMicToggle: () => void;
  handleSpeechStart: () => void;
  handleCallToggle: () => Promise<void>;
  openPageDialog: () => void;
  closePageDialog: () => void;
  submitPageSelection: (pages: number[]) => Promise<void>;
  handleUpload: (file: File | null) => Promise<string | null>;
  handleSwitchDocument: (documentId: string) => Promise<void>;
  closeDocument: () => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  error: null,
  callMode: false,
  hasIntroduced: false,
  mobilePane: "teacher",
  speechLanguage: "",
  saveCost: false,
  selectedPages: [1],
  pageDialogOpen: false,
  showTranscript: false,
  showCaption: true,
  pendingQuestion: null,

  setError: (error) => set({ error }),

  setPendingQuestion: (question) => {
    set({ pendingQuestion: get().callMode ? question : null });
  },

  dismissQuestion: () => set({ pendingQuestion: null }),
  toggleTranscript: () => set((s) => ({ showTranscript: !s.showTranscript })),
  setTranscript: (showTranscript) => set({ showTranscript }),
  toggleCaption: () => set((s) => ({ showCaption: !s.showCaption })),
  setMobilePane: (mobilePane) => set({ mobilePane }),
  setSpeechLanguage: (speechLanguage) => set({ speechLanguage }),

  initSaveCost: () => {
    set({ saveCost: window.localStorage.getItem(SAVE_COST_KEY) === "1" });
  },

  toggleSaveCost: () => {
    const next = !get().saveCost;
    window.localStorage.setItem(SAVE_COST_KEY, next ? "1" : "0");
    set({ saveCost: next });
  },

  handleVoiceTranscript: (transcript) => {
    const trimmed = transcript.trim();
    if (get().pendingQuestion) set({ pendingQuestion: null });
    if (trimmed) {
      useSpeechStore.getState().showUserCaption(trimmed);
      useChatStore.getState().sendMessage(trimmed);
    }
  },

  maybeContinueCall: () => {
    if (!get().callMode) return;
    setTimeout(() => {
      if (get().callMode && !useChatStore.getState().isStreaming) {
        useVoiceStore.getState().start();
      }
    }, CALL_RESUME_DELAY_MS);
  },

  clearChat: () => {
    useChatStore.getState().resetMessages();
    useDocumentStore.getState().applyReference(null);
    set({ hasIntroduced: false, error: null, pendingQuestion: null });
    if (get().callMode) {
      set({ callMode: false });
      useVoiceStore.getState().cancel();
    }
    useSpeechStore.getState().stopSpeaking();
    useSpeechStore.getState().resetPaused();
  },

  handleMicToggle: () => {
    const voice = useVoiceStore.getState();
    if (voice.isListening) {
      voice.stop();
    } else {
      if (get().pendingQuestion) set({ pendingQuestion: null });
      useChatStore.getState().abort();
      useSpeechStore.getState().stopSpeaking();
      useSpeechStore.getState().unlockAudio();
      voice.start();
    }
  },

  handleSpeechStart: () => {
    if (!get().callMode) return;
    const speaking = useSpeechStore.getState().isSpeaking;
    const streaming = useChatStore.getState().isStreaming;
    if (!speaking && !streaming) return;
    if (get().pendingQuestion) set({ pendingQuestion: null });
    useChatStore.getState().abort();
    useSpeechStore.getState().stopSpeaking();
  },

  handleCallToggle: async () => {
    if (get().callMode) {
      set({ callMode: false, pendingQuestion: null });
      useChatStore.getState().abort();
      useVoiceStore.getState().cancel();
      useSpeechStore.getState().stopSpeaking();
      useSpeechStore.getState().resetPaused();
      return;
    }

    if (!useVoiceStore.getState().isSupported) {
      set({ error: "Microphone is not supported in this browser." });
      return;
    }

    set({ pageDialogOpen: true });
    void useVoiceStore.getState().prewarm();
  },

  openPageDialog: () => {
    useChatStore.getState().abort();
    useSpeechStore.getState().stopSpeaking();
    set({ pageDialogOpen: true });
    void useVoiceStore.getState().prewarm();
  },

  closePageDialog: () => set({ pageDialogOpen: false }),

  submitPageSelection: async (pages) => {
    useSpeechStore.getState().unlockAudio();

    const cleaned = pages.length > 0 ? pages : [1];
    set({ selectedPages: cleaned, pageDialogOpen: false });

    if (get().callMode) return;

    const voice = useVoiceStore.getState();

    const granted = await voice.requestPermission();
    if (!granted) return;

    set({ callMode: true, hasIntroduced: true });

    void voice.start();
    void useChatStore.getState().sendMessage(GREETING_PROMPT, { hidden: true });
  },

  handleUpload: async (file) => {
    useChatStore.getState().resetMessages();
    set({ selectedPages: [1], pageDialogOpen: false });
    return useDocumentStore.getState().uploadFile(file);
  },

  handleSwitchDocument: async (documentId) => {
    const docs = useDocumentStore.getState();
    if (docs.loadedDocument?.document.id === documentId) {
      return;
    }
    useChatStore.getState().resetMessages();
    useSpeechStore.getState().stopSpeaking();
    if (get().callMode) {
      set({ callMode: false });
      useVoiceStore.getState().cancel();
    }
    useSpeechStore.getState().resetPaused();
    set({ hasIntroduced: false, selectedPages: [1], pageDialogOpen: false, pendingQuestion: null });
    await docs.selectDocument(documentId);
  },

  closeDocument: () => {
    useChatStore.getState().resetMessages();
    useSpeechStore.getState().stopSpeaking();
    if (get().callMode) {
      set({ callMode: false });
      useVoiceStore.getState().cancel();
    }
    useSpeechStore.getState().resetPaused();
    set({ hasIntroduced: false, selectedPages: [1], pageDialogOpen: false, error: null, pendingQuestion: null });
    useDocumentStore.getState().closeDocument();
  }
}));
