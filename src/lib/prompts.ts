/**
 * Centralized LLM prompt copy and tutor generation tuning.
 *
 * Edit wording or tuning here — `src/server/openai.ts` only handles transport
 * and streaming, so prompt changes never touch API-call code.
 */
import type { DocumentChunk, Reference } from "./types";

/** ISO 639-1 code → display name, used to pin the tutor's reply language. */
export const LANGUAGE_NAMES: Record<string, string> = {
  ja: "Japanese",
  en: "English",
  ar: "Arabic"
};

/** Tunable generation parameters for the tutor model. */
export const TUTOR_GENERATION = {
  /**
   * Reasoning effort. gpt-5.x are reasoning models: without this they spend
   * effort before emitting a visible token. "none" gives the fastest
   * time-to-first-word, which is what a live voice tutor needs.
   * (gpt-5.4-mini accepts: none, low, medium, high, xhigh.)
   */
  reasoningEffort: "none",
  /** Cap replies so voice playback starts — and finishes — sooner. */
  maxOutputTokens: 700,
  /** How many prior conversation turns to send as history. */
  historyWindow: 8
} as const;

/** Builds the system instructions that shape the document tutor's behavior. */
export function buildTutorInstructions(title: string, language?: string): string {
  const languageName = language ? LANGUAGE_NAMES[language] : undefined;
  const languageRule = languageName
    ? `Always respond entirely in ${languageName}, regardless of the language of the document or the student's message. Every reply, including check-in questions, must be in ${languageName}.`
    : "Respond in the same language the student writes or speaks in.";

  return [
    `You are a calm, engaging AI teacher helping a student learn "${title}".`,
    languageRule,
    "Teach only from the supplied document context. If the document does not contain the answer, say that clearly.",
    "Use short paragraphs, concrete examples, and one small check-in question when useful.",
    "When the student asks to continue, move to the next important idea from the context.",
    "Do not mention embeddings, chunks, retrieval, or internal tooling."
  ].join("\n");
}

/** Builds the user turn that pairs retrieved context with the student's request. */
export function buildTutorUserTurn(context: string, message: string): string {
  return `Document context:\n${context}\n\nStudent request:\n${message}`;
}

/** Hidden prompt that asks the tutor to open the lesson with a spoken greeting. */
export const GREETING_PROMPT =
  "Greet the student warmly in 2-3 short sentences. Introduce yourself as their AI teacher " +
  "for this document. Briefly list what you can do: summarize sections, explain concepts in " +
  "plain language, quiz them, and answer any question grounded in the document. End by asking " +
  "what they'd like to start with. Do not include citations or page numbers in this greeting.";

/** Demo-mode answer used when no OpenAI key is configured on the server. */
export function buildFallbackAnswer(
  reference: Reference | null,
  firstChunk?: DocumentChunk
): string {
  const sourceText =
    reference?.snippet ||
    firstChunk?.snippet ||
    "I found the document, but I could not extract a useful passage yet.";
  const pageText = reference ? `On page ${reference.pageNumber}, ` : "";

  return [
    "I can teach from this document in local demo mode.",
    `${pageText}the most relevant passage says: "${sourceText}"`,
    "A simple way to understand it is to identify the main claim, then connect each detail back to that claim.",
    "What part would you like me to slow down and explain next?"
  ].join("\n\n");
}
