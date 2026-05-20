import { create } from "zustand";
import { CALL_RESUME_DELAY_MS, GREETING_PROMPT } from "@/lib/constants";
import { useChatStore } from "./chatStore";
import { useDocumentStore } from "./documentStore";
import { useSpeechStore } from "./speechStore";
import { useVoiceStore } from "./voiceStore";
import type { MobilePane, SpeechLanguage } from "@/lib/types";

const SAVE_COST_KEY = "saveCostMode";

interface SessionStore {
  error: string | null;
  callMode: boolean;
  hasIntroduced: boolean;
  mobilePane: MobilePane;
  speechLanguage: SpeechLanguage;
  saveCost: boolean;
  setError: (error: string | null) => void;
  setMobilePane: (mobilePane: MobilePane) => void;
  setSpeechLanguage: (speechLanguage: SpeechLanguage) => void;
  initSaveCost: () => void;
  toggleSaveCost: () => void;
  handleVoiceTranscript: (transcript: string) => void;
  maybeContinueCall: () => void;
  clearChat: () => void;
  handleMicToggle: () => void;
  handleCallToggle: () => Promise<void>;
  handleUpload: (file: File | null) => void;
  handleSwitchDocument: (documentId: string) => Promise<void>;
}

/**
 * Session store — the orchestrator. Owns cross-cutting workspace state
 * (call mode, language, save-cost, errors, the mobile pane) and wires the
 * interactions that span the document, chat, speech, and voice stores.
 *
 * `mobilePane` values: "document" | "teacher".
 */
export const useSessionStore = create<SessionStore>((set, get) => ({
  error: null,
  callMode: false,
  hasIntroduced: false,
  mobilePane: "teacher",
  speechLanguage: "ja",
  // "Save-cost mode": cheaper tutor model + shorter history. Off by default;
  // the learner's choice is restored from localStorage via initSaveCost().
  saveCost: false,

  setError: (error) => set({ error }),
  setMobilePane: (mobilePane) => set({ mobilePane }),
  setSpeechLanguage: (speechLanguage) => set({ speechLanguage }),

  /** Restores the saved save-cost choice once, on app start. */
  initSaveCost: () => {
    set({ saveCost: window.localStorage.getItem(SAVE_COST_KEY) === "1" });
  },

  toggleSaveCost: () => {
    const next = !get().saveCost;
    window.localStorage.setItem(SAVE_COST_KEY, next ? "1" : "0");
    set({ saveCost: next });
  },

  /** A final voice transcript: caption it, then send it as a chat message. */
  handleVoiceTranscript: (transcript) => {
    const trimmed = transcript.trim();
    if (trimmed) {
      // Play the learner's words back as a caption before the teacher replies.
      useSpeechStore.getState().showUserCaption(trimmed);
      useChatStore.getState().sendMessage(trimmed);
    }
  },

  /** After an answer finishes, resume listening if still on a call. */
  maybeContinueCall: () => {
    if (!get().callMode) return;
    setTimeout(() => {
      if (get().callMode && !useChatStore.getState().isStreaming) {
        useVoiceStore.getState().start();
      }
    }, CALL_RESUME_DELAY_MS);
  },

  /** Clears the chat and resets the lesson to a fresh session. */
  clearChat: () => {
    useChatStore.getState().resetMessages();
    useDocumentStore.getState().applyReference(null);
    set({ hasIntroduced: false, error: null });
    if (get().callMode) {
      set({ callMode: false });
      useVoiceStore.getState().cancel();
    }
    useSpeechStore.getState().stopSpeaking();
  },

  /** Mic button: toggle listening, stopping playback before a new turn. */
  handleMicToggle: () => {
    const voice = useVoiceStore.getState();
    if (voice.isListening) {
      voice.stop();
    } else {
      useSpeechStore.getState().stopSpeaking();
      voice.start();
    }
  },

  /** Call button: start or end the hands-free voice call. */
  handleCallToggle: async () => {
    const voice = useVoiceStore.getState();

    if (get().callMode) {
      set({ callMode: false });
      // End the call: abort every in-flight request — chat stream,
      // transcription, and TTS — alongside stopping the mic and playback.
      useChatStore.getState().abort();
      voice.cancel();
      useSpeechStore.getState().stopSpeaking();
      return;
    }

    if (!voice.isSupported) {
      set({ error: "Microphone is not supported in this browser." });
      return;
    }

    // Ask for the mic up front, on this click — the one chance for a clean
    // one-click grant before the user can block it.
    const granted = await voice.requestPermission();
    if (!granted) {
      return;
    }

    set({ callMode: true });

    if (!get().hasIntroduced) {
      set({ hasIntroduced: true });
      useChatStore.getState().sendMessage(GREETING_PROMPT, { hidden: true });
    } else {
      voice.start();
    }
  },

  /** Upload button: reset the chat, then upload the new lesson document. */
  handleUpload: (file) => {
    useChatStore.getState().resetMessages();
    useDocumentStore.getState().uploadFile(file);
  },

  /** Library switch: reset the chat, then load an existing document. */
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
    set({ hasIntroduced: false });
    await docs.selectDocument(documentId);
  }
}));
