import { create } from "zustand";
import { VoiceRecorder } from "@/services/voice";
import { useSessionStore } from "./sessionStore";
import { useSpeechStore } from "./speechStore";
import type { MicPermission } from "@/types";

interface VoiceStore {
  isListening: boolean;
  isTranscribing: boolean;
  isSupported: boolean;
  micMuted: boolean;
  permission: MicPermission;
  init: () => void;
  requestPermission: () => Promise<boolean>;
  startSession: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => void;
  cancel: () => void;
  toggleMicMuted: () => void;
}

// One recorder instance for the app lifetime; the store mirrors its state.
const recorder = new VoiceRecorder();

/**
 * Voice store: microphone permission, the continuous Silero-VAD capture session,
 * and the transcription round-trip. The mic stays open for the whole call
 * (full-duplex) so the learner can interrupt the tutor by simply speaking — the
 * neural VAD rejects noise (coughs/clatter become misfires) and browser echo
 * cancellation keeps the tutor's own voice out, so only real speech cuts in.
 */
export const useVoiceStore = create<VoiceStore>((set, get) => {
  recorder.onState = (patch) => {
    if (patch.isListening) useSpeechStore.getState().clearCaption();
    set(patch);
  };
  recorder.onTranscript = (text) =>
    useSessionStore.getState().handleVoiceTranscript(text);
  // Confirmed real speech (not noise) → interrupt the tutor if it's talking.
  recorder.onSpeechStart = () => useSessionStore.getState().handleBargeIn();
  recorder.onError = (message) => useSessionStore.getState().setError(message);
  // Read lazily so the latest UI language selection is used at upload time.
  recorder.getLanguage = () => useSessionStore.getState().speechLanguage || undefined;

  return {
    isListening: false,
    isTranscribing: false,
    isSupported: true,
    micMuted: false,
    permission: "unknown",

    /** Detects support and watches the live permission state. */
    init: () => {
      set({ isSupported: recorder.isSupportedNow() });
      recorder.watchPermission();
    },
    requestPermission: () => recorder.requestPermission(),
    /** Boot the continuous mic session for the call. */
    startSession: () => recorder.startSession(),
    start: () => recorder.start(),
    stop: () => recorder.stop(),
    cancel: () => {
      set({ micMuted: false });
      recorder.cancel();
    },
    /** Manual Mute-Mic button on the control bar. */
    toggleMicMuted: () => {
      const next = !get().micMuted;
      set({ micMuted: next });
      recorder.setUserMuted(next);
    }
  };
});
