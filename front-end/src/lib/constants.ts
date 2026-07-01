import type { SpeechLanguageOption } from "@/types";

export const SPEECH_LANGUAGES = [
  { value: "ja", label: "Japanese" },
  { value: "en", label: "English" },
  { value: "ar", label: "Arabic" },
  { value: "", label: "Auto" }
] satisfies SpeechLanguageOption[];

export const GREETING_PROMPT = "START THE LESSON";

export const MAX_LESSON_PAGES = 5;

export const CALL_RESUME_DELAY_MS = 350;

export const VOICE_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: false
};

export const VAD_POSITIVE_SPEECH_THRESHOLD = 0.7;
export const VAD_NEGATIVE_SPEECH_THRESHOLD = 0.45;
export const VAD_MIN_SPEECH_MS = 600;
export const VAD_REDEMPTION_MS = 900;
export const VAD_PRE_SPEECH_PAD_MS = 600;

export const VAD_MIN_RMS = 0.04;

export const VAD_ASSET_BASE = "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.30/dist/";
export const ORT_WASM_BASE = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/";

export const ACCEPTED_UPLOAD_TYPES = ".pdf,application/pdf";
