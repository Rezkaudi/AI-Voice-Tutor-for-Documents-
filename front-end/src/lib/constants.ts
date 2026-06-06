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
  "Greet the student warmly in ONE or two short spoken sentences and introduce yourself as their AI " +
  "teacher for this lesson. Assume they have not read it and know nothing about it yet. Then, in the " +
  "SAME reply, immediately BEGIN the lesson: go to the FIRST page of the lesson and teach its very " +
  "first single idea with one clear, concrete example. Teach ONLY that one idea — do not summarise the " +
  "whole page. Finish by handing the turn back with one small task or question that checks they " +
  "understood it, like a real teacher would. Keep the greeting itself free of page numbers, but follow " +
  "your normal citation rules for the idea you teach so the right lines highlight as you speak.";

/**
 * The most pages a student may pick for one focused lesson. Mirrors
 * `MAX_LESSON_PAGES` on the back-end.
 */
export const MAX_LESSON_PAGES = 5;

/** Gap before listening resumes so playback fully releases the audio device. */
export const CALL_RESUME_DELAY_MS = 350;

/** File types accepted by the upload widgets. */
export const ACCEPTED_UPLOAD_TYPES =
  ".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown";
