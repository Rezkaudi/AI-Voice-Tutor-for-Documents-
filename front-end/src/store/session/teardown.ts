import { endLessonSession } from "@/services/documentsApi";
import { useDocumentStore } from "../documentStore";
import { useSpeechStore } from "../speechStore";
import { useVoiceStore } from "../voiceStore";
import type { SessionStore } from "./types";

type Set = (partial: Partial<SessionStore>) => void;
type Get = () => SessionStore;

/**
 * End any in-progress voice call and halt speech playback.
 * Single source of truth for the teardown shared by clearChat, call toggle,
 * and document switch/close.
 */
export function haltCall(set: Set, get: Get): void {
  if (get().callMode) {
    set({ callMode: false });
    useVoiceStore.getState().cancel();
    void endLessonSession();
  }
  useSpeechStore.getState().stopSpeaking();
  useSpeechStore.getState().resetPaused();
  useDocumentStore.getState().applyReference(null);
}
