import OpenAI from "openai";
import type { Reference } from "@/domain/entities/chat";
import type { EmbeddingService } from "@/domain/services/embedding-service";
import type { ChunkRanker } from "@/domain/logic/chunk-ranker";
import type { CitationResolver, CitationCandidate } from "@/domain/logic/citation-resolver";
import type { TutorReplyRequest, TutorService, TutorStreamEvent } from "@/domain/services/tutor-service";
import { buildTutorInstructions, TUTOR_GENERATION, TUTOR_TOOLS } from "./tutor-prompts";
import type { EnvConfig } from "@/config/env.config";

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
 * loop until it produces spoken text.
 */
export class OpenAiTutorService implements TutorService {
  private readonly client: OpenAI;

  constructor(
    private readonly config: EnvConfig,
    private readonly embeddings: EmbeddingService,
    private readonly ranker: ChunkRanker,
    private readonly citations: CitationResolver
  ) {
    this.client = new OpenAI({ apiKey: config.OPENAI_API_KEY });
  }

  async *streamReply(
    request: TutorReplyRequest,
    signal: AbortSignal
  ): AsyncGenerator<TutorStreamEvent> {
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
    // Verbatim citations the model recorded via cite_passages this turn.
    const citedCandidates: CitationCandidate[] = [];

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
            request,
            citedCandidates,
            this.citations
          );
          // Align inline [[N]] markers with the citations panel: drop any
          // citation the answer never references, renumber the remaining
          // markers contiguously, and emit the reconciled text.
          const aligned = reconcileMarkersWithCitations(stepText, reference);
          if (aligned.reference) {
            yield { type: "reference", reference: aligned.reference };
          }
          yield { type: "delta", text: aligned.text };
        }
        return;
      }

      pendingInput = [];
      for (const call of toolCalls) {
        if (call.name === "cite_passages") {
          const recorded = recordCitations(call.args, citedCandidates);
          pendingInput.push({
            type: "function_call_output",
            call_id: call.callId,
            output: recorded
              ? `Recorded ${recorded} citation(s).`
              : "No usable citations were recorded — quotes must be exact substrings of the page text."
          });
          continue;
        }
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
      const ranked = this.ranker.rank(query, request.chunks, embedding).slice(0, 10);
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
          chunkId: item.chunk.id,
          citations: []
        });
      }
      return { output, references };
    }

    return { output: `Unknown tool: ${name}`, references: [] };
  }

}

/**
 * Keeps the inline [[N]] markers and the citations panel in lockstep.
 *
 * The model can record more citations than it actually marks in the text
 * (e.g. 5 in `cite_passages`, but only `[[1]]` and `[[2]]` appear in the
 * answer). When that happens the side panel ends up showing 5 references the
 * student can never click — confusing. We drop unreferenced citations and
 * renumber the surviving ones to `[[1]]…[[K]]` so text and panel match.
 */
function reconcileMarkersWithCitations(
  text: string,
  reference: Reference | null
): { text: string; reference: Reference | null } {
  if (!reference || reference.citations.length === 0) {
    return { text, reference };
  }
  const used: number[] = [];
  for (const m of text.matchAll(/\[\[(\d+)\]\]/g)) {
    const n = Number(m[1]);
    if (
      Number.isFinite(n) &&
      n >= 1 &&
      n <= reference.citations.length &&
      !used.includes(n)
    ) {
      used.push(n);
    }
  }
  const remap = new Map<number, number>();
  used.forEach((oldIdx, i) => remap.set(oldIdx, i + 1));
  // Always rewrite so any out-of-range marker (e.g. [[5]] when only 4
  // citations were recorded) is stripped, even if the kept markers happen
  // to already form a contiguous 1..K sequence.
  const remappedText = text.replace(/\[\[(\d+)\]\]/g, (_, raw) => {
    const next = remap.get(Number(raw));
    return next ? `[[${next}]]` : "";
  });
  const remappedCitations = used.map((oldIdx) => reference.citations[oldIdx - 1]!);
  return {
    text: remappedText,
    reference: { ...reference, citations: remappedCitations }
  };
}

/**
 * Chooses the reference to show — prefers the page(s) of verbatim citations the
 * model recorded via cite_passages, then the first page the answer explicitly
 * cites ("on page 4, ..."), falling back to the last tool's top hit.
 */
function pickCitedReference(
  answer: string,
  referencesByPage: Map<number, Reference>,
  fallback: Reference | null,
  request: TutorReplyRequest,
  citedCandidates: ReadonlyArray<CitationCandidate>,
  citations: CitationResolver
): Reference | null {
  const resolvedCitations = citations.resolve(citedCandidates, request.pages);

  // Citations beat regex — when the model recorded verbatim quotes, anchor the
  // jump to the page of the first one and attach every resolved span.
  if (resolvedCitations.length > 0) {
    const primaryPage = resolvedCitations[0]!.pageNumber;
    const base = referencesByPage.get(primaryPage)
      ?? buildPageReference(primaryPage, request)
      ?? { pageNumber: primaryPage, citations: [] };
    return { ...base, citations: resolvedCitations };
  }

  // The save-cost model often skips `cite_passages`. In that case pick a page
  // (from the answer's regex or the last tool's top hit) and synthesise
  // citations by ranking that page's sentences against the spoken answer, so
  // the UI still highlights the supporting text.
  let chosen: Reference | null = null;
  for (const match of answer.matchAll(/\bpages?\s+(\d+)\b/gi)) {
    const pageNumber = Number(match[1]);
    chosen = referencesByPage.get(pageNumber)
      ?? buildPageReference(pageNumber, request);
    if (chosen) break;
  }
  chosen ??= fallback;
  if (!chosen) return null;

  const page = request.pages.find(
    (item) => item.pageNumber === chosen!.pageNumber
  );
  if (page) {
    const auto = citations.autoCiteFromAnswer(answer, page);
    if (auto.length > 0) {
      return { ...chosen, citations: auto };
    }
  }
  return chosen;
}

/** Builds a page reference (number, chunk id) for one page number. */
function buildPageReference(
  pageNumber: number,
  request: TutorReplyRequest
): Reference | null {
  const page = request.pages.find((item) => item.pageNumber === pageNumber);
  if (!page) {
    return null;
  }
  const reference: Reference = { pageNumber: page.pageNumber, citations: [] };
  const chunkId = request.chunks.find(
    (chunk) => chunk.pageNumber === page.pageNumber
  )?.id;
  if (chunkId) {
    reference.chunkId = chunkId;
  }
  return reference;
}

/** Parses a cite_passages tool call and appends its quotes to the buffer. */
function recordCitations(
  rawArgs: string,
  buffer: CitationCandidate[]
): number {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArgs || "{}");
  } catch {
    return 0;
  }
  if (!parsed || typeof parsed !== "object") {
    return 0;
  }
  const list = (parsed as { citations?: unknown }).citations;
  if (!Array.isArray(list)) {
    return 0;
  }
  let recorded = 0;
  for (const entry of list) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const page = Number((entry as { page?: unknown }).page);
    const quoteRaw = (entry as { quote?: unknown }).quote;
    if (!Number.isInteger(page) || page < 1 || typeof quoteRaw !== "string") {
      continue;
    }
    const quote = quoteRaw.trim();
    if (!quote) {
      continue;
    }
    buffer.push({ pageNumber: page, quote });
    recorded += 1;
  }
  return recorded;
}

/**
 * Preview of a page for `get_outline`. Surfaces the first non-empty line (often
 * the heading) and a short body snippet so the tutor can spot section
 * boundaries — "Docker for React" vs. a random snippet on the same page.
 */
function previewLine(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) {
    return "(empty page)";
  }
  const heading = lines[0]!;
  const body = lines.slice(1).join(" ").replace(/\s+/g, " ").trim();
  const headingPart = heading.length > 120 ? `${heading.slice(0, 120)}...` : heading;
  if (!body) {
    return headingPart;
  }
  const bodyBudget = Math.max(40, 240 - headingPart.length);
  const bodyPart = body.length > bodyBudget ? `${body.slice(0, bodyBudget)}...` : body;
  return `${headingPart} — ${bodyPart}`;
}
