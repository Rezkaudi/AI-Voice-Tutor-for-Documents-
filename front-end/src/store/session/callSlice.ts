import type { StateCreator } from "zustand";
import { CALL_RESUME_DELAY_MS, GREETING_PROMPT } from "@/lib/constants";
import { prepareLessonPages } from "@/services/documentsApi";
import { useChatStore } from "../chatStore";
import { useDocumentStore } from "../documentStore";
import { useSpeechStore } from "../speechStore";
import { useVoiceStore } from "../voiceStore";
import { haltCall } from "./teardown";
import type { CallSlice, SessionStore } from "./types";

export const createCallSlice: StateCreator<SessionStore, [], [], CallSlice> = (set, get) => {

  const prepareAndProceed = async (): Promise<void> => {
    const documentId = useDocumentStore.getState().loadedDocument?.document.id;
    const updating = get().callMode;
    const pages = get().selectedPages;

    if (documentId) {
      set({ preparingPages: true, prepareError: null });
      try {
        await prepareLessonPages(documentId, pages);
      } catch (error) {
        set({
          preparingPages: false,
          prepareError:
            error instanceof Error
              ? error.message
              : "Your pages could not be prepared. Please try again."
        });
        return;
      }
      set({ preparingPages: false, prepareError: null });
    }

    if (updating) {
      useSpeechStore.getState().resumeThinkingCue();
      return;
    }

    set({ callMode: true, hasIntroduced: true });
    void useVoiceStore.getState().start();
    void useChatStore.getState().sendMessage(GREETING_PROMPT, { hidden: true });
  };

  return {
    callMode: false,
    hasIntroduced: false,
    selectedPages: [1],
    pageDialogOpen: false,
    preparingPages: false,
    prepareError: null,

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

    endCall: () => {
      if (!get().callMode) return;
      set({ pendingQuestion: null });
      haltCall(set, get);
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
      const updating = get().callMode;
      set({ selectedPages: cleaned, pageDialogOpen: false, prepareError: null });

      if (!updating) {
        useSpeechStore.getState().unlockAudio();
        const granted = await useVoiceStore.getState().requestPermission();
        if (!granted) return;
      }

      await prepareAndProceed();
    },

    retryPreparePages: async () => {
      await prepareAndProceed();
    },

    cancelPreparePages: () => set({ preparingPages: false, prepareError: null })
  };
};
