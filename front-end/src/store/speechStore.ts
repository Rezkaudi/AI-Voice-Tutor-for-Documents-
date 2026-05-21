import { create } from "zustand";
import { SpeechEngine } from "@/services/speech";
import type { SpeechCaption, SpeechSession } from "@/lib/types";

interface SpeechStore {
  isSpeaking: boolean;
  caption: SpeechCaption | null;
  stopSpeaking: () => void;
  createSpeechSession: () => SpeechSession;
  showUserCaption: (text: string) => void;
}

// One engine instance for the app lifetime; the store mirrors its state.
const engine = new SpeechEngine();

/**
 * Speech store: voicing tutor answers and showing live captions.
 */
export const useSpeechStore = create<SpeechStore>((set) => {
  engine.onSpeakingChange = (isSpeaking) => set({ isSpeaking });
  engine.onCaption = (caption) => set({ caption });

  return {
    isSpeaking: false,
    caption: null,

    /** Cancels every in-flight TTS fetch and playback. */
    stopSpeaking: () => engine.stopSpeaking(),
    /** Opens an ordered TTS session — see SpeechEngine.createSession. */
    createSpeechSession: () => engine.createSession(),
    /** Plays the learner's transcribed sentence back as a caption. */
    showUserCaption: (text) => engine.showUserCaption(text)
  };
});
