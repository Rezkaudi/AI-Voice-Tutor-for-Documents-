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
  /** Pages the student chose for this lesson (1-based, max MAX_LESSON_PAGES). */
  selectedPages: number[];
  /** Whether the page-picker modal is open. */
  pageDialogOpen: boolean;
  /** Whether the full lesson transcript is shown. */
  showTranscript: boolean;
  /** Whether live spoken captions are shown. */
  showCaption: boolean;
  setError: (error: string | null) => void;
  toggleTranscript: () => void;
  toggleCaption: () => void;
  setMobilePane: (mobilePane: MobilePane) => void;
  setSpeechLanguage: (speechLanguage: SpeechLanguage) => void;
  initSaveCost: () => void;
  toggleSaveCost: () => void;
  handleVoiceTranscript: (transcript: string) => void;
  maybeContinueCall: () => void;
  clearChat: () => void;
  handleMicToggle: () => void;
  handleCallToggle: () => Promise<void>;
  openPageDialog: () => void;
  closePageDialog: () => void;
  submitPageSelection: (pages: number[]) => Promise<void>;
  handleUpload: (file: File | null) => Promise<string | null>;
  handleSwitchDocument: (documentId: string) => Promise<void>;
  closeDocument: () => void;
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
  speechLanguage: "",
  // "Save-cost mode": cheaper tutor model + shorter history. Off by default;
  // the learner's choice is restored from localStorage via initSaveCost().
  saveCost: false,
  // The focused lesson defaults to page 1; the picker lets the learner change it.
  selectedPages: [1],
  pageDialogOpen: false,
  // Transcript starts hidden (the call leads with the avatar + caption);
  // captions are on by default.
  showTranscript: false,
  showCaption: true,

  setError: (error) => set({ error }),
  toggleTranscript: () => set((s) => ({ showTranscript: !s.showTranscript })),
  toggleCaption: () => set((s) => ({ showCaption: !s.showCaption })),
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

  /**
   * Mic button: toggle listening. Tapping it while the teacher is talking is a
   * barge-in — abort the in-flight answer (LLM stream + queued TTS) and cut the
   * current playback so the learner can take the floor immediately.
   */
  handleMicToggle: () => {
    const voice = useVoiceStore.getState();
    if (voice.isListening) {
      voice.stop();
    } else {
      useChatStore.getState().abort();
      useSpeechStore.getState().stopSpeaking();
      useSpeechStore.getState().unlockAudio();
      voice.start();
    }
  },

  /**
   * Call button. Ending a call tears everything down immediately; starting one
   * opens the page-picker first so the learner confirms which pages to study —
   * the actual call begins from {@link submitPageSelection}.
   */
  handleCallToggle: async () => {
    if (get().callMode) {
      set({ callMode: false });
      // End the call: abort every in-flight request — chat stream,
      // transcription, and TTS — alongside stopping the mic and playback.
      useChatStore.getState().abort();
      useVoiceStore.getState().cancel();
      useSpeechStore.getState().stopSpeaking();
      return;
    }

    if (!useVoiceStore.getState().isSupported) {
      set({ error: "Microphone is not supported in this browser." });
      return;
    }

    // Always confirm the lesson pages before a call starts — this is the
    // learner's chance to edit them every time they call.
    set({ pageDialogOpen: true });
  },

  /** Open the page-picker (e.g. to edit the lesson pages mid-call). */
  openPageDialog: () => set({ pageDialogOpen: true }),

  /** Close the page-picker without changing anything. */
  closePageDialog: () => set({ pageDialogOpen: false }),

  /**
   * Confirm the chosen lesson pages. Mid-call this just updates the selection
   * (the next message picks it up). Before a call it also starts the call:
   * grab the mic, then either greet-and-teach or resume listening.
   */
  submitPageSelection: async (pages) => {
    useSpeechStore.getState().unlockAudio();

    const cleaned = pages.length > 0 ? pages : [1];
    set({ selectedPages: cleaned, pageDialogOpen: false });

    // Editing pages during an active call — nothing else to do.
    if (get().callMode) return;

    const voice = useVoiceStore.getState();
    // Ask for the mic up front, on this click — the one chance for a clean
    // one-click grant before the user can block it.
    const granted = await voice.requestPermission();
    if (!granted) return;

    set({ callMode: true });

    if (!get().hasIntroduced) {
      set({ hasIntroduced: true });
      useChatStore.getState().sendMessage(GREETING_PROMPT, { hidden: true });
    } else {
      voice.start();
    }
  },

  /** Upload button: reset the chat, then upload the new lesson document. */
  handleUpload: async (file) => {
    useChatStore.getState().resetMessages();
    // A new document is a fresh lesson — reset the page selection to page 1.
    set({ selectedPages: [1], pageDialogOpen: false });
    return useDocumentStore.getState().uploadFile(file);
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
    // A different document is a fresh lesson — reset the page selection.
    set({ hasIntroduced: false, selectedPages: [1], pageDialogOpen: false });
    await docs.selectDocument(documentId);
  },

  /** Back button: tear down the lesson and return to the upload/library view. */
  closeDocument: () => {
    useChatStore.getState().resetMessages();
    useSpeechStore.getState().stopSpeaking();
    if (get().callMode) {
      set({ callMode: false });
      useVoiceStore.getState().cancel();
    }
    set({ hasIntroduced: false, selectedPages: [1], pageDialogOpen: false, error: null });
    useDocumentStore.getState().closeDocument();
  }
}));
