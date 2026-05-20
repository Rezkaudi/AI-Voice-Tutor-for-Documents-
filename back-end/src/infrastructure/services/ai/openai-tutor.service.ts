import OpenAI from "openai";
import type { Reference } from "@/domain/entities/chat";
import type { EmbeddingService } from "@/domain/services/embedding-service";
import {
  buildReferenceSnippet,
  rankChunks
} from "@/application/services/retrieval";
import type {
  TutorReplyRequest,
  TutorService,
  TutorStreamEvent
} from "@/domain/services/tutor-service";
import type { EnvConfig } from "@/config/env.config";
import {
  buildFallbackAnswer,
  buildTutorInstructions,
  TUTOR_GENERATION,
  TUTOR_TOOLS
} from "./tutor-prompts";

/** Character batch size for streaming the local demo-mode answer. */
const FALLBACK_STREAM_CHUNK = 36;

/** A pending tool call surfaced by one response step. */
interface PendingToolCall {
  callId: string;
  name: string;
  args: string;
}

/**
 * `TutorService` backed by OpenAI.
 *
 * The model reads the document agentically: it calls `search_document` /
 * `get_page` / `get_outline`, we run each tool and feed the result back, and
 * loop until it produces spoken text. With no API key it streams a local demo
 * answer instead, so the app stays usable offline.
 */
export class OpenAiTutorService implements TutorService {
  private readonly client: OpenAI | null;

  constructor(
    private readonly config: EnvConfig,
    private readonly embeddings: EmbeddingService
  ) {
    this.client = config.OPENAI_API_KEY
      ? new OpenAI({ apiKey: config.OPENAI_API_KEY })
      : null;
  }

  async *streamReply(
    request: TutorReplyRequest,
    signal: AbortSignal
  ): AsyncGenerator<TutorStreamEvent> {
    if (!this.client) {
      yield* this.streamFallbackAnswer(request);
      return;
    }

    // Bind to keep `this` — a detached `responses.create` loses its client.
    const createResponse = this.client.responses.create.bind(
      this.client.responses
    ) as unknown as (
      body: Record<string, unknown>,
      options: { signal: AbortSignal }
    ) => Promise<AsyncIterable<Record<string, unknown>>>;

    const tutorModel = request.saveCost
      ? this.config.OPENAI_TUTOR_MODEL_SAVE_COST
      : this.config.OPENAI_TUTOR_MODEL;
    const historyWindow = request.saveCost
      ? TUTOR_GENERATION.historyWindowSaveCost
      : TUTOR_GENERATION.historyWindow;
    const reasoningEffort = request.saveCost
      ? TUTOR_GENERATION.reasoningEffortSaveCost
      : TUTOR_GENERATION.reasoningEffort;

    // First turn carries history + the student's message; later turns chain
    // off `previous_response_id` and carry only the tool outputs.
    let pendingInput: Record<string, unknown>[] = [
      ...request.history.slice(-historyWindow).map((message) => ({
        role: message.role,
        content: message.content
      })),
      { role: "user", content: request.message }
    ];
    let previousResponseId: string | undefined;

    // Every page the tools surface this turn, keyed by page number. The shown
    // reference is matched to the page the final answer actually cites.
    const referencesByPage = new Map<number, Reference>();
    let fallbackReference: Reference | null = null;

    for (let step = 0; step < TUTOR_GENERATION.maxToolSteps; step += 1) {
      const stream = await createResponse(
        {
          model: tutorModel,
          instructions: buildTutorInstructions(
            request.document.title,
            request.language || undefined
          ),
          reasoning: { effort: reasoningEffort },
          max_output_tokens: TUTOR_GENERATION.maxOutputTokens,
          tools: TUTOR_TOOLS,
          input: pendingInput,
          ...(previousResponseId
            ? { previous_response_id: previousResponseId }
            : {}),
          stream: true
        },
        { signal }
      );

      const toolCalls: PendingToolCall[] = [];
      // Buffer text per output item. The model can emit multiple message items
      // in one response (e.g. an interim restatement plus the final answer);
      // concatenating every delta indiscriminately would double the reply.
      const textByOutputIndex = new Map<number, string>();

      for await (const event of stream) {
        if (
          event.type === "response.output_text.delta" &&
          typeof event.delta === "string"
        ) {
          const index =
            typeof event.output_index === "number" ? event.output_index : 0;
          textByOutputIndex.set(
            index,
            (textByOutputIndex.get(index) ?? "") + event.delta
          );
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

      // Pick the last message item — earlier items are interim restatements
      // the final item already contains. A step with tool calls is preamble
      // the model restates next step, so its text is dropped below anyway.
      const lastIndex = [...textByOutputIndex.keys()].sort((a, b) => a - b).pop();
      const stepText =
        lastIndex === undefined ? "" : (textByOutputIndex.get(lastIndex) ?? "");

      // No tool calls → the model has given its final spoken answer.
      if (toolCalls.length === 0) {
        if (stepText) {
          const reference = pickCitedReference(
            stepText,
            referencesByPage,
            fallbackReference,
            request
          );
          if (reference) {
            yield { type: "reference", reference };
          }
          yield { type: "delta", text: stepText };
        }
        return;
      }

      pendingInput = [];
      for (const call of toolCalls) {
        const result = await this.runTutorTool(call.name, call.args, request);
        for (const reference of result.references) {
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

  /** Runs one tutor tool call, returning its text output and page candidates. */
  private async runTutorTool(
    name: string,
    rawArgs: string,
    request: TutorReplyRequest
  ): Promise<{ output: string; references: Reference[] }> {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(rawArgs || "{}");
    } catch {
      args = {};
    }

    if (name === "get_outline") {
      const outline = request.pages
        .map((page) => `Page ${page.pageNumber}: ${previewLine(page.text)}`)
        .join("\n");
      return {
        output: outline || "The document has no readable pages.",
        references: []
      };
    }

    if (name === "get_page") {
      const pageNumber = Number(args.page);
      const page = request.pages.find(
        (item) => item.pageNumber === pageNumber
      );
      if (!page) {
        return {
          output: `There is no page ${pageNumber}. The document has ${request.pages.length} page(s).`,
          references: []
        };
      }
      const reference = buildPageReference(page.pageNumber, request);
      return {
        output: `[Page ${page.pageNumber}]\n${page.text}`,
        references: reference ? [reference] : []
      };
    }

    if (name === "search_document") {
      const query =
        typeof args.query === "string" && args.query.trim()
          ? args.query
          : request.message;
      const embedding = await this.embeddings.embedQuery(query).catch(() => null);
      const ranked = rankChunks(query, request.chunks, embedding).slice(0, 6);
      if (!ranked.length) {
        return {
          output: "No matching passages were found in the document.",
          references: []
        };
      }

      const output = ranked
        .map((item) => `[Page ${item.chunk.pageNumber}] ${item.chunk.text}`)
        .join("\n\n");

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

  /** Local demo answer used when no OpenAI key is configured. */
  private async *streamFallbackAnswer(
    request: TutorReplyRequest
  ): AsyncGenerator<TutorStreamEvent> {
    const firstChunk = request.chunks[0];
    const reference: Reference | null = firstChunk
      ? {
          pageNumber: firstChunk.pageNumber,
          snippet: firstChunk.snippet,
          chunkId: firstChunk.id
        }
      : null;

    if (reference) {
      yield { type: "reference", reference };
    }

    const answer = buildFallbackAnswer(reference, firstChunk);
    for (
      let index = 0;
      index < answer.length;
      index += FALLBACK_STREAM_CHUNK
    ) {
      yield {
        type: "delta",
        text: answer.slice(index, index + FALLBACK_STREAM_CHUNK)
      };
    }
  }
}

/**
 * Chooses the reference to show — prefers the first page the answer explicitly
 * cites ("on page 4, ..."), falling back to the last tool's top hit.
 */
function pickCitedReference(
  answer: string,
  referencesByPage: Map<number, Reference>,
  fallback: Reference | null,
  request: TutorReplyRequest
): Reference | null {
  for (const match of answer.matchAll(/\bpages?\s+(\d+)\b/gi)) {
    const pageNumber = Number(match[1]);
    const surfaced = referencesByPage.get(pageNumber);
    if (surfaced) {
      return surfaced;
    }
    const built = buildPageReference(pageNumber, request);
    if (built) {
      return built;
    }
  }
  return fallback;
}

/** Builds a page reference (number, snippet, chunk id) for one page number. */
function buildPageReference(
  pageNumber: number,
  request: TutorReplyRequest
): Reference | null {
  const page = request.pages.find((item) => item.pageNumber === pageNumber);
  if (!page) {
    return null;
  }
  const reference: Reference = {
    pageNumber: page.pageNumber,
    snippet: buildReferenceSnippet(page.text, request.message)
  };
  const chunkId = request.chunks.find(
    (chunk) => chunk.pageNumber === page.pageNumber
  )?.id;
  if (chunkId) {
    reference.chunkId = chunkId;
  }
  return reference;
}

/** One-line preview of a page, used by the get_outline tool. */
function previewLine(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) {
    return "(empty page)";
  }
  return clean.length > 140 ? `${clean.slice(0, 140)}...` : clean;
}
