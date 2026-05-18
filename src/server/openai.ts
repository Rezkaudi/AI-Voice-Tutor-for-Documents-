import OpenAI from "openai";
import { appConfig, hasOpenAIConfig } from "@/lib/config";
import {
  buildFallbackAnswer,
  buildTutorInstructions,
  TUTOR_GENERATION,
  TUTOR_TOOLS
} from "@/lib/prompts";
import { buildReferenceSnippet, rankChunks } from "@/lib/retrieval";
import type {
  ChatMessage,
  DocumentChunk,
  DocumentPage,
  DocumentRecord,
  Reference
} from "@/lib/types";

/** A streamed tutor turn: spoken text, or a page reference for the UI to show. */
export type TutorStreamEvent =
  | { type: "delta"; text: string }
  | { type: "reference"; reference: Reference };

// Character batch size for streaming the local demo-mode answer.
const FALLBACK_STREAM_CHUNK = 36;

let client: OpenAI | null = null;

export async function embedTexts(texts: string[]): Promise<(number[] | null)[]> {
  if (!hasOpenAIConfig() || texts.length === 0) {
    return texts.map(() => null);
  }

  const openai = getClient();

  // Split into API-sized batches, then run every batch concurrently instead of
  // sequentially. For a multi-page document this turns N round trips into one.
  const batches: string[][] = [];
  for (let index = 0; index < texts.length; index += 96) {
    batches.push(texts.slice(index, index + 96));
  }

  const responses = await Promise.all(
    batches.map((batch) =>
      openai.embeddings.create({
        model: appConfig.embeddingModel,
        input: batch
      })
    )
  );

  return responses.flatMap((response) => response.data.map((item) => item.embedding));
}

export async function synthesizeSpeech(text: string): Promise<ArrayBuffer> {
  if (!hasOpenAIConfig()) {
    throw new Error("Voice output needs OPENAI_API_KEY to be configured on the server.");
  }

  const openai = getClient();
  const response = await openai.audio.speech.create({
    model: appConfig.speechModel,
    voice: appConfig.speechVoice,
    input: text,
    response_format: "mp3"
  });
  return await response.arrayBuffer();
}

export async function transcribeAudio(file: File, language?: string): Promise<string> {
  if (!hasOpenAIConfig()) {
    throw new Error("Voice input needs OPENAI_API_KEY to be configured on the server.");
  }

  const openai = getClient();
  const response = await openai.audio.transcriptions.create({
    file,
    model: appConfig.transcribeModel,
    ...(language ? { language } : {})
  });
  return (response.text || "").trim();
}

export async function embedQuery(query: string): Promise<number[] | null> {
  if (!hasOpenAIConfig()) {
    return null;
  }

  const [embedding] = await embedTexts([query]);
  return embedding ?? null;
}

type TutorInput = {
  document: DocumentRecord;
  message: string;
  language?: string;
  history: ChatMessage[];
  pages: DocumentPage[];
  chunks: DocumentChunk[];
};

/**
 * Streams a tutor answer. The model reads the document agentically: it calls
 * `search_document` / `get_page` / `get_outline` as needed, we run each tool
 * and feed the result back, and loop until the model produces spoken text.
 */
export async function* streamTutorAnswer(input: TutorInput): AsyncGenerator<TutorStreamEvent> {
  if (!hasOpenAIConfig()) {
    yield* streamFallbackAnswer(input);
    return;
  }

  const openai = getClient();
  // Bind to keep `this` — a detached `openai.responses.create` loses its client.
  const createResponse = openai.responses.create.bind(openai.responses) as unknown as (
    body: Record<string, unknown>
  ) => Promise<AsyncIterable<Record<string, unknown>>>;

  // First turn carries history + the student's message. Later turns chain off
  // `previous_response_id` and carry only the tool outputs.
  let pendingInput: Record<string, unknown>[] = [
    ...input.history.slice(-TUTOR_GENERATION.historyWindow).map((message) => ({
      role: message.role,
      content: message.content
    })),
    { role: "user", content: input.message }
  ];
  let previousResponseId: string | undefined;

  // Every page the tools surface this turn, keyed by page number. The reference
  // shown to the student is chosen from here once the final answer is known —
  // matched to the page the answer actually cites, not the last tool's top hit.
  const referencesByPage = new Map<number, Reference>();
  // Top reference of the most recent tool result, used when the answer cites
  // no page at all.
  let fallbackReference: Reference | null = null;

  for (let step = 0; step < TUTOR_GENERATION.maxToolSteps; step += 1) {
    const stream = await createResponse({
      model: appConfig.tutorModel,
      instructions: buildTutorInstructions(input.document.title, input.language),
      reasoning: { effort: TUTOR_GENERATION.reasoningEffort },
      max_output_tokens: TUTOR_GENERATION.maxOutputTokens,
      tools: TUTOR_TOOLS,
      input: pendingInput,
      ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
      stream: true
    });

    const toolCalls: { callId: string; name: string; args: string }[] = [];
    // Buffer this step's spoken text instead of streaming it live. A step that
    // also calls a tool is just a preamble the model restates on the next step,
    // so its text would otherwise be shown (and spoken) twice.
    let stepText = "";

    for await (const event of stream) {
      if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
        stepText += event.delta;
      } else if (event.type === "response.output_item.done") {
        const item = event.item as Record<string, unknown> | undefined;
        if (item?.type === "function_call") {
          toolCalls.push({
            callId: String(item.call_id),
            name: String(item.name),
            args: typeof item.arguments === "string" ? item.arguments : "{}"
          });
        }
      } else if (event.type === "response.completed") {
        const response = event.response as Record<string, unknown> | undefined;
        if (response?.id) {
          previousResponseId = String(response.id);
        }
      }
    }

    // No tool calls means the model has given its final spoken answer. Pick the
    // reference to match the page the answer cites, then emit it before the
    // text. Earlier steps that called tools are discarded — their text is
    // preamble the model repeats in this final answer.
    if (toolCalls.length === 0) {
      if (stepText) {
        const reference = pickCitedReference(stepText, referencesByPage, fallbackReference, input);
        if (reference) {
          yield { type: "reference", reference };
        }
        yield { type: "delta", text: stepText };
      }
      return;
    }

    pendingInput = [];
    for (const call of toolCalls) {
      const result = await runTutorTool(call.name, call.args, input);
      for (const reference of result.references) {
        // Keep the first snippet seen for a page — later tool calls add pages
        // without overwriting an already-surfaced one.
        if (!referencesByPage.has(reference.pageNumber)) {
          referencesByPage.set(reference.pageNumber, reference);
        }
      }
      if (result.references[0]) {
        fallbackReference = result.references[0];
      }
      pendingInput.push({
        type: "function_call_output",
        call_id: call.callId,
        output: result.output
      });
    }
  }
}

/**
 * Chooses the reference to show the student. Prefers the first page the answer
 * explicitly cites ("on page 4, ...") so the document panel always matches what
 * the tutor is talking about; falls back to the last tool's top hit otherwise.
 */
function pickCitedReference(
  answer: string,
  referencesByPage: Map<number, Reference>,
  fallback: Reference | null,
  input: TutorInput
): Reference | null {
  for (const match of answer.matchAll(/\bpages?\s+(\d+)\b/gi)) {
    const pageNumber = Number(match[1]);
    const surfaced = referencesByPage.get(pageNumber);
    if (surfaced) {
      return surfaced;
    }
    // The answer cites a valid page the tools never returned a reference for —
    // build one so the panel still follows the answer.
    const built = buildPageReference(pageNumber, input);
    if (built) {
      return built;
    }
  }
  return fallback;
}

/** Builds a page reference (number, snippet, chunk id) for one page number. */
function buildPageReference(pageNumber: number, input: TutorInput): Reference | null {
  const page = input.pages.find((item) => item.pageNumber === pageNumber);
  if (!page) {
    return null;
  }
  return {
    pageNumber: page.pageNumber,
    snippet: buildReferenceSnippet(page.text, input.message),
    chunkId: input.chunks.find((chunk) => chunk.pageNumber === page.pageNumber)?.id
  };
}

/**
 * Runs one tutor tool call and returns its text output plus every page it
 * surfaced as a candidate reference. The caller picks which one the student
 * sees, matched to the page the final answer cites.
 */
async function runTutorTool(
  name: string,
  rawArgs: string,
  input: TutorInput
): Promise<{ output: string; references: Reference[] }> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(rawArgs || "{}");
  } catch {
    args = {};
  }

  if (name === "get_outline") {
    const outline = input.pages
      .map((page) => `Page ${page.pageNumber}: ${previewLine(page.text)}`)
      .join("\n");
    return { output: outline || "The document has no readable pages.", references: [] };
  }

  if (name === "get_page") {
    const pageNumber = Number(args.page);
    const page = input.pages.find((item) => item.pageNumber === pageNumber);
    if (!page) {
      return {
        output: `There is no page ${pageNumber}. The document has ${input.pages.length} page(s).`,
        references: []
      };
    }
    const reference = buildPageReference(page.pageNumber, input);
    return {
      output: `[Page ${page.pageNumber}]\n${page.text}`,
      references: reference ? [reference] : []
    };
  }

  if (name === "search_document") {
    const query = typeof args.query === "string" && args.query.trim() ? args.query : input.message;
    const embedding = await embedQuery(query).catch(() => null);
    const ranked = rankChunks(query, input.chunks, embedding).slice(0, 6);
    if (!ranked.length) {
      return { output: "No matching passages were found in the document.", references: [] };
    }

    const output = ranked
      .map((item) => `[Page ${item.chunk.pageNumber}] ${item.chunk.text}`)
      .join("\n\n");

    // One reference per page, in rank order — so a search that returns chunks
    // from pages 3 and 4 lets the answer cite either and still match.
    const references: Reference[] = [];
    const seenPages = new Set<number>();
    for (const item of ranked) {
      if (seenPages.has(item.chunk.pageNumber)) {
        continue;
      }
      seenPages.add(item.chunk.pageNumber);
      references.push({
        pageNumber: item.chunk.pageNumber,
        snippet: buildReferenceSnippet(item.chunk.text, query),
        chunkId: item.chunk.id
      });
    }
    return { output, references };
  }

  return { output: `Unknown tool: ${name}`, references: [] };
}

/** One-line preview of a page, used by the get_outline tool. */
function previewLine(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) {
    return "(empty page)";
  }
  return clean.length > 140 ? `${clean.slice(0, 140)}...` : clean;
}

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: appConfig.openaiApiKey });
  }

  return client;
}

async function* streamFallbackAnswer(input: TutorInput): AsyncGenerator<TutorStreamEvent> {
  const firstChunk = input.chunks[0];
  const reference: Reference | null = firstChunk
    ? { pageNumber: firstChunk.pageNumber, snippet: firstChunk.snippet, chunkId: firstChunk.id }
    : null;

  if (reference) {
    yield { type: "reference", reference };
  }

  const answer = buildFallbackAnswer(reference, firstChunk);
  for (let index = 0; index < answer.length; index += FALLBACK_STREAM_CHUNK) {
    yield { type: "delta", text: answer.slice(index, index + FALLBACK_STREAM_CHUNK) };
  }
}
