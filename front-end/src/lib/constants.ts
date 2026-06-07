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
  "Greet the student warmly in ONE short spoken sentence and introduce yourself as their AI teacher " +
  "for this lesson. Assume they have not read it and know nothing about it yet. Then, in the SAME " +
  "reply, OPEN the lesson on the FIRST page by introducing the topic itself — a short, clear " +
  "introduction in three beats, each as its own short sentence on its own line so the right lines " +
  "highlight as you speak: (1) name the grammar point or topic that the page's title introduces; " +
  "(2) state what it MEANS; (3) explain HOW TO USE it — how it is formed or what it attaches to, " +
  "from the page's 'How To Use' or structure block. Do NOT teach the worked examples yet and do not " +
  "summarise the rest of the page — the examples come in the next turns, one at a time. Finish by " +
  "handing the turn back with one small task or question that checks they understood the meaning and " +
  "how to form it, like a real teacher would. Keep the greeting itself free of page numbers, but " +
  "follow your normal citation rules for the title, the meaning, and the how-to-use so all three " +
  "lines highlight as you speak.";

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
