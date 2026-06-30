import { create } from "zustand";
import { SpeechEngine } from "@/services/speech";
import type { SpeechCaption, SpeechSession } from "@/types";

interface SpeechStore {
  isSpeaking: boolean;
  agentPaused: boolean;
  caption: SpeechCaption | null;
  unlockAudio: () => void;
  stopSpeaking: () => void;
  clearCaption: () => void;
  createSpeechSession: () => SpeechSession;
  showUserCaption: (text: string) => void;
  toggleAgentPaused: () => void;
}

const engine = new SpeechEngine();

export const useSpeechStore = create<SpeechStore>((set, get) => {
  engine.onSpeakingChange = (isSpeaking) => set({ isSpeaking });
  engine.onCaption = (caption) => set({ caption });

  return {
    isSpeaking: false,
    agentPaused: false,
    caption: null,

    unlockAudio: () => engine.unlock(),

    stopSpeaking: () => engine.stopSpeaking(),

    clearCaption: () => engine.clearCaption(),

    createSpeechSession: () => engine.createSession(),

    showUserCaption: (text) => engine.showUserCaption(text),

    toggleAgentPaused: () => {
      const next = !get().agentPaused;
      engine.setPaused(next);
      set({ agentPaused: next });
    }
  };
});
