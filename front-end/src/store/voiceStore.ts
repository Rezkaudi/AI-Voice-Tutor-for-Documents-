import { create } from "zustand";
import { VoiceRecorder } from "@/services/voice";
import { useSessionStore } from "./sessionStore";
import { useSpeechStore } from "./speechStore";
import type { MicPermission } from "@/types";

interface VoiceStore {
  isListening: boolean;
  isUserSpeaking: boolean;
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
  setMicMuted: (value: boolean) => void;
}

const recorder = new VoiceRecorder();

export const useVoiceStore = create<VoiceStore>((set, get) => {
  recorder.onState = (patch) => {
    if (patch.isUserSpeaking) useSpeechStore.getState().clearCaption();
    set(patch);
  };
  recorder.onTranscript = (text) =>
    useSessionStore.getState().handleVoiceTranscript(text);
  recorder.onSpeechStart = () => useSessionStore.getState().handleSpeechStart();
  recorder.onError = (message) => useSessionStore.getState().setError(message);
  recorder.getLanguage = () => useSessionStore.getState().speechLanguage || undefined;

  return {
    isListening: false,
    isUserSpeaking: false,
    isTranscribing: false,
    isSupported: true,
    micMuted: false,
    permission: "unknown",

    init: () => {
      set({ isSupported: recorder.isSupportedNow() });
      recorder.watchPermission();
    },
    requestPermission: () => recorder.requestPermission(),
    startSession: () => recorder.startSession(),
    start: () => recorder.start(),
    stop: () => recorder.stop(),
    cancel: () => {
      set({ micMuted: false });
      recorder.cancel();
    },
    toggleMicMuted: () => get().setMicMuted(!get().micMuted),
    setMicMuted: (value) => {
      if (get().micMuted === value) return;
      set({ micMuted: value });
      recorder.setUserMuted(value);
    }
  };
});
