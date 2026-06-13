import type { SpeechLanguageOption } from "@/lib/types";

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

export const SILENCE_TIMEOUT_MS = 10_000;

/** File types accepted by the upload widgets. PDF only. */
export const ACCEPTED_UPLOAD_TYPES = ".pdf,application/pdf";
