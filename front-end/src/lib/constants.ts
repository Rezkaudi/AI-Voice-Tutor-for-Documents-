import type { SpeechLanguageOption } from "@/types";

export const SPEECH_LANGUAGES = [
  { value: "ja", label: "Japanese" },
  { value: "en", label: "English" },
  { value: "ar", label: "Arabic" },
  { value: "", label: "Auto" }
] satisfies SpeechLanguageOption[];

export const GREETING_PROMPT = "START THE LESSON";

export const MAX_LESSON_PAGES = 5;

// Wait before the mic listens again after the tutor speaks (ms).
export const CALL_RESUME_DELAY_MS = 350;

export const VOICE_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,   // remove the tutor's own voice from your mic
  noiseSuppression: true,   // remove background noise
  autoGainControl: true     // auto raise/lower mic volume
};

export const VAD_POSITIVE_SPEECH_THRESHOLD = 0.7;// Confidence to say "speech STARTED" (0-1). Higher = harder to trigger.
export const VAD_NEGATIVE_SPEECH_THRESHOLD = 0.45;// Below this confidence = treated as silence (0-1).
export const VAD_MIN_SPEECH_MS = 600;// Speech shorter than this is ignored as noise (ms). Lower = catch short words.
export const VAD_REDEMPTION_MS = 900;// Silence to wait before saying "user finished talking" (ms).
export const VAD_PRE_SPEECH_PAD_MS = 600;// Extra audio kept before the start, so the first word is not cut (ms).
export const VAD_ASSET_BASE = "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.30/dist/";
export const ORT_WASM_BASE = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/";

export const ACCEPTED_UPLOAD_TYPES = ".pdf,application/pdf";
