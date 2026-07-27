import type { StateCreator } from "zustand";
import type { SessionStore, UiSlice } from "./types";

export const createUiSlice: StateCreator<SessionStore, [], [], UiSlice> = (set, get) => ({
  error: null,
  speechLanguage: "",
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
  setSpeechLanguage: (speechLanguage) => set({ speechLanguage })
});
