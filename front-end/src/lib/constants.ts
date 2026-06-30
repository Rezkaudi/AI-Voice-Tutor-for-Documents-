import type { SpeechLanguageOption } from "@/types";

/**
 * Business constants shared across the app.
 * Nothing here imports React, Zustand, or any browser/transport concern.
 */

/** Languages the learner can pin the tutor's speech to. `""` means auto-detect. */
export const SPEECH_LANGUAGES = [
  { value: "ja", label: "Japanese" },
  { value: "en", label: "English" },
  { value: "ar", label: "Arabic" },
  { value: "", label: "Auto" }
] satisfies SpeechLanguageOption[];

/**
 * Hidden prompt that asks the tutor to open the lesson with a spoken greeting.
 * Mirrors `GREETING_PROMPT` in the original backend project.
 */
export const GREETING_PROMPT =
  "START THE LESSON";

/**
 * The most pages a student may pick for one focused lesson. Mirrors
 * `MAX_LESSON_PAGES` on the back-end.
 */
export const MAX_LESSON_PAGES = 5;

/** Gap before listening resumes so playback fully releases the audio device. */
export const CALL_RESUME_DELAY_MS = 350;

/**
 * Microphone constraints used for every capture. The browser's own DSP does the
 * heavy lifting for free:
 * - `echoCancellation` stops the tutor's own spoken answer (coming out of the
 *   speakers) from being heard as the learner talking — this is what lets us
 *   keep the mic open *while the tutor speaks* without it interrupting itself.
 * - `noiseSuppression` strips steady background noise (fans, hiss, traffic).
 * - `autoGainControl` evens out quiet vs. loud speakers.
 */
export const VOICE_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true
};

/**
 * Silero VAD (neural voice-activity detection via `@ricky0123/vad-web`) tuning.
 * This is what makes turn-taking and barge-in noise-robust: the model scores how
 * speech-like each frame is, so a cough/clap/keyboard never counts as the
 * learner talking — those become an `onVADMisfire`, not a real turn.
 *
 * - `positive/negativeSpeechThreshold`: model probability bands for speech.
 * - `minSpeechMs`: a segment shorter than this is discarded as noise (misfire) —
 *   the key knob that stops short noises from interrupting the tutor.
 * - `redemptionMs`: trailing silence allowed mid-thought before we call the turn
 *   over (end-of-turn = hands-free auto-send). Higher = more patient.
 * - `preSpeechPadMs`: audio kept *before* detected speech so the first word isn't
 *   clipped from the transcript.
 */
export const VAD_POSITIVE_SPEECH_THRESHOLD = 0.5;
export const VAD_NEGATIVE_SPEECH_THRESHOLD = 0.35;
export const VAD_MIN_SPEECH_MS = 400;
export const VAD_REDEMPTION_MS = 900;
export const VAD_PRE_SPEECH_PAD_MS = 600;

/**
 * The VAD fetches its worklet + ONNX model + ORT wasm at runtime. We pin both to
 * a CDN matching the installed package versions so there's no Vite static-copy
 * step. ⚠️ If `@ricky0123/vad-web` or `onnxruntime-web` is bumped in
 * package.json, bump these versions too or the assets will mismatch the runtime.
 */
export const VAD_ASSET_BASE = "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.30/dist/";
export const ORT_WASM_BASE = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/";

/** File types accepted by the upload widgets. PDF only. */
export const ACCEPTED_UPLOAD_TYPES = ".pdf,application/pdf";
