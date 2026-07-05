import type { StateCreator } from "zustand";
import { CALL_RESUME_DELAY_MS, GREETING_PROMPT } from "@/lib/constants";
import { useChatStore } from "../chatStore";
import { useSpeechStore } from "../speechStore";
import { useVoiceStore } from "../voiceStore";
import { haltCall } from "./teardown";
import type { CallSlice, SessionStore } from "./types";

export const createCallSlice: StateCreator<SessionStore, [], [], CallSlice> = (set, get) => ({
  callMode: false,
  hasIntroduced: false,
  selectedPages: [1],
  pageDialogOpen: false,

  handleVoiceTranscript: (transcript) => {
    const trimmed = transcript.trim();
    if (!trimmed) return;

    if (get().pendingQuestion) set({ pendingQuestion: null });
    if (get().callMode) {
      useChatStore.getState().abort();
      useSpeechStore.getState().stopSpeaking();
    }
    useSpeechStore.getState().showUserCaption(trimmed);
    useChatStore.getState().sendMessage(trimmed);
  },

  maybeContinueCall: () => {
    if (!get().callMode) return;
    setTimeout(() => {
      if (get().callMode && !useChatStore.getState().isStreaming) {
        useVoiceStore.getState().start();
      }
    }, CALL_RESUME_DELAY_MS);
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

  handleCallToggle: async () => {
    if (get().callMode) {
      set({ pendingQuestion: null });
      useChatStore.getState().abort();
      haltCall(set, get);
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
    if (!get().callMode) {
      useChatStore.getState().abort();
      useSpeechStore.getState().stopSpeaking();
    }
    set({ pageDialogOpen: true });
    void useVoiceStore.getState().prewarm();
  },

  closePageDialog: () => set({ pageDialogOpen: false }),

  submitPageSelection: async (pages) => {
    const cleaned = pages.length > 0 ? pages : [1];
    set({ selectedPages: cleaned, pageDialogOpen: false });

    if (get().callMode) {

      useSpeechStore.getState().resumeThinkingCue();
      return;
    }
    useSpeechStore.getState().unlockAudio();

    const voice = useVoiceStore.getState();

    const granted = await voice.requestPermission();
    if (!granted) return;

    set({ callMode: true, hasIntroduced: true });

    void voice.start();
    void useChatStore.getState().sendMessage(GREETING_PROMPT, { hidden: true });
  }
});
