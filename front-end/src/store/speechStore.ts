import { create } from "zustand";
import { SpeechEngine } from "@/services/speech";
import type { SpeechCaption, SpeechSession } from "@/types";

interface SpeechStore {
  isSpeaking: boolean;
  agentMuted: boolean;
  caption: SpeechCaption | null;
  unlockAudio: () => void;
  stopSpeaking: () => void;
  clearCaption: () => void;
  createSpeechSession: () => SpeechSession;
  showUserCaption: (text: string) => void;
  toggleAgentMuted: () => void;
}

const engine = new SpeechEngine();

export const useSpeechStore = create<SpeechStore>((set, get) => {
  engine.onSpeakingChange = (isSpeaking) => set({ isSpeaking });
  engine.onCaption = (caption) => set({ caption });

  return {
    isSpeaking: false,
    agentMuted: false,
    caption: null,

    unlockAudio: () => engine.unlock(),

    stopSpeaking: () => engine.stopSpeaking(),

    clearCaption: () => engine.clearCaption(),

    createSpeechSession: () => engine.createSession(),

    showUserCaption: (text) => engine.showUserCaption(text),

    toggleAgentMuted: () => {
      const next = !get().agentMuted;
      engine.setMuted(next);
      set({ agentMuted: next });
    }
  };
});
