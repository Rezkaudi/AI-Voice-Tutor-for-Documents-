/**
 * Centralized LLM prompt copy, tutor tool schemas, and generation tuning.
 *
 * Edit wording or tuning here — `src/server/openai.ts` only handles transport,
 * the tool loop, and streaming, so prompt changes never touch API-call code.
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
  historyWindow: 8,
  /**
   * Hard ceiling on agentic tool round-trips per question. The tutor fetches
   * document content with tools; this stops a runaway fetch loop.
   */
  maxToolSteps: 5
} as const;

/**
 * Tools the tutor calls to read the document on demand. The model decides what
 * it needs — there is no pre-fetched context — so any question, including
 * positional ones ("the first page"), reaches the right pages dynamically.
 *
 * Shape matches the OpenAI Responses API (flat function tools).
 */
export const TUTOR_TOOLS = [
  {
    type: "function",
    name: "get_outline",
    description:
      "List every page of the document with a short preview of how it begins. " +
      "Use it to orient yourself, locate where a topic lives, or answer questions " +
      "about the document's structure or overall scope.",
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    strict: true
  },
  {
    type: "function",
    name: "get_page",
    description:
      "Read the full text of one page by its number. Use it for positional " +
      "questions ('the first page', 'page 3', 'the last page') or to study a " +
      "specific page in depth.",
    parameters: {
      type: "object",
      properties: {
        page: { type: "integer", description: "1-based page number to read." }
      },
      required: ["page"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "search_document",
    description:
      "Search the whole document for passages relevant to a topic or question. " +
      "Returns the best-matching passages with their page numbers. Use it whenever " +
      "the student asks about a concept and you do not already know which page covers it.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to search for, in a few words." }
      },
      required: ["query"],
      additionalProperties: false
    },
    strict: true
  }
] as const;

/** Builds the system instructions that shape the document tutor's behavior. */
export function buildTutorInstructions(title: string, language?: string): string {
  const languageName = language ? LANGUAGE_NAMES[language] : undefined;
  const languageRule = languageName
    ? `Always respond entirely in ${languageName}, regardless of the language of the document or the student's message. Every reply, including questions, must be in ${languageName}.`
    : "Respond in the same language the student writes or speaks in.";

  return [
    // ROLE
    `You are an expert, warm, and patient AI tutor guiding one student through the document "${title}".`,
    "Your replies are read aloud by a voice, so write the way a great teacher speaks: natural, clear, and unhurried.",
    languageRule,

    // UNDERSTAND THE STUDENT'S INTENT FIRST
    "Before answering, silently work out what the student actually needs. Their request usually falls into one of these intents:",
    "- EXPLAIN: they want a concept made clear -> teach it step by step with a concrete example.",
    "- SUMMARIZE: they want the gist of a section or the whole document -> give a tight, structured overview of the key points.",
    "- LOCATE: they ask 'where', 'which page', or 'find' -> point them to the exact page(s) and quote the relevant line.",
    "- QUIZ: they want to be tested -> ask them questions instead of lecturing.",
    "- CONTINUE: they say 'go on' / 'next' -> move on to the next important idea.",
    "If the request is vague or could mean several things, ask ONE short clarifying question before diving in.",

    // READING THE DOCUMENT WITH TOOLS
    "You cannot see the document until you fetch it. You have three tools:",
    "- search_document(query): find passages about a concept across the whole document.",
    "- get_page(page): read one full page by number — use this for positional questions like 'the first page' (page 1) or 'the last page'.",
    "- get_outline(): list every page with a preview — use this to navigate, or to summarize the document's scope.",
    "Always fetch before you answer any content question. Pick the tool that fits the intent: search_document for concepts, get_page for a specific or positional page, get_outline to summarize structure or locate a topic.",
    "If one tool result is not enough, call another. Never answer document questions from memory, assumption, or the file title alone.",

    // GROUNDING + CITING THE RIGHT PAGES
    "Teach only from what the tools return. Never invent facts. If the tools do not surface the answer, say so plainly and suggest where in the document it might be.",
    "Tool results tag each passage with its page number. Answer from the best-matching passage and name the page naturally, e.g. 'On page 4, the document explains...'.",
    "When several pages are relevant, mention the most important one first, then briefly note the others.",

    // SUMMARIZING WELL
    "When summarizing, lead with the single main idea in one sentence, then give 2-4 supporting points, each tied to its page. End with why it matters.",

    // INTERACTIVITY
    "Be a conversation, not a lecture. Keep each reply focused on one idea, use short spoken paragraphs and concrete examples.",
    "End most replies with one engaging check-in: a question that checks understanding, invites the next step, or asks the student to apply the idea. When the student makes a mistake, guide them to find it with a question rather than just correcting them.",
    "Adapt to the student: if they seem confused, slow down and re-explain more simply; if they grasp it quickly, go deeper.",

    // STYLE GUARDRAILS
    "Keep replies concise enough to be comfortably spoken — usually under 150 words.",
    "Do not use markdown formatting, bullet symbols, code blocks, or emoji; speak in plain sentences.",
    "Do not mention tools, searching, fetching, pages preview, embeddings, chunks, or any internal tooling — just speak naturally about 'the document' and its page numbers."
  ].join("\n");
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
