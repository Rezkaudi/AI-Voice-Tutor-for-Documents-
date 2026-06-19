import { create } from "zustand";
import { SpeechEngine } from "@/services/speech";
import type { SpeechCaption, SpeechSession } from "@/lib/types";

interface SpeechStore {
  isSpeaking: boolean;
  caption: SpeechCaption | null;
  unlockAudio: () => void;
  stopSpeaking: () => void;
  clearCaption: () => void;
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

    /** Unlocks iOS audio playback — call from a user-gesture handler. */
    unlockAudio: () => engine.unlock(),
    /** Cancels every in-flight TTS fetch and playback. */
    stopSpeaking: () => engine.stopSpeaking(),
    /** Drops the visible caption without stopping playback. */
    clearCaption: () => engine.clearCaption(),
    /** Opens an ordered TTS session — see SpeechEngine.createSession. */
    createSpeechSession: () => engine.createSession(),
    /** Plays the learner's transcribed sentence back as a caption. */
    showUserCaption: (text) => engine.showUserCaption(text)
  };
});
