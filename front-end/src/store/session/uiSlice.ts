import type { StateCreator } from "zustand";
import type { SessionStore, UiSlice } from "./types";

const SAVE_COST_KEY = "saveCostMode";

export const createUiSlice: StateCreator<SessionStore, [], [], UiSlice> = (set, get) => ({
  error: null,
  mobilePane: "teacher",
  speechLanguage: "",
  saveCost: false,
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
  }
});
