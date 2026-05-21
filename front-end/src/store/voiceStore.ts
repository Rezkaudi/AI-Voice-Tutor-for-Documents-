import { create } from "zustand";
import { VoiceRecorder } from "@/services/voice";
import { useSessionStore } from "./sessionStore";
import type { MicPermission } from "@/lib/types";

interface VoiceStore {
  isListening: boolean;
  isTranscribing: boolean;
  isSupported: boolean;
  permission: MicPermission;
  init: () => void;
  requestPermission: () => Promise<boolean>;
  start: () => Promise<void>;
  stop: () => void;
  cancel: () => void;
}

// One recorder instance for the app lifetime; the store mirrors its state.
const recorder = new VoiceRecorder();

/**
 * Voice store: microphone permission, recording, and the
 * transcription round-trip.
 */
export const useVoiceStore = create<VoiceStore>((set) => {
  recorder.onState = (patch) => set(patch);
  recorder.onTranscript = (text) =>
    useSessionStore.getState().handleVoiceTranscript(text);
  recorder.onError = (message) => useSessionStore.getState().setError(message);
  // Read lazily so the latest UI language selection is used at upload time.
  recorder.getLanguage = () => useSessionStore.getState().speechLanguage || undefined;

  return {
    isListening: false,
    isTranscribing: false,
    isSupported: true,
    permission: "unknown",

    /** Detects support and begins watching the live permission state. */
    init: () => {
      set({ isSupported: recorder.isSupportedNow() });
      recorder.watchPermission();
    },
    requestPermission: () => recorder.requestPermission(),
    start: () => recorder.start(),
    stop: () => recorder.stop(),
    cancel: () => recorder.cancel()
  };
});
