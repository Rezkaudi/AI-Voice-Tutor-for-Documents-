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
  "Greet the student warmly in 2-3 short spoken sentences. Introduce yourself as their AI teacher " +
  "for this document. Assume they have not read it and know nothing about it yet — reassure them " +
  "you will walk them through it together, step by step, and that you will not just talk at them: " +
  "you will teach a little, then have them try it themselves with their own examples, and coach them " +
  "as they go, like a real teacher. Tell them they can ask you anything or ask to be quizzed at any time. " +
  "End by asking whether they'd " +
  "like you to start teaching the document from the beginning, or to jump to something specific. " +
  "Do not include citations or page numbers in this greeting.";

/** Gap before listening resumes so playback fully releases the audio device. */
export const CALL_RESUME_DELAY_MS = 350;
