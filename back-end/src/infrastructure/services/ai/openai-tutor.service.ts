import OpenAI from "openai";
import type { Reference } from "@/domain/entities/chat";
import type { CitationCandidate } from "@/domain/logic/citation-resolver";
import type { ReferenceSelector } from "@/domain/logic/citation/reference-selector";
import type { CitationMarkerReconciler } from "@/domain/logic/citation/citation-marker-reconciler";
import type {
  TutorReplyRequest,
  TutorService,
  TutorStreamEvent
} from "@/domain/services/tutor-service";
import type { EnvConfig } from "@/config/env.config";
import { TutorRequestFactory } from "./tutor-request-factory";
import { TutorToolExecutor } from "./tutor-tool-executor";
import { CitePassagesParser } from "./cite-passages-parser";
import {
  OpenAiResponseStreamReader,
  type PendingToolCall
} from "./openai-response-stream-reader";
import { logger } from "@/shared/logger";

/** OpenAI's streaming create call, narrowed to what this adapter uses. */
type CreateResponse = (
  body: Record<string, unknown>,
  options: { signal: AbortSignal }
) => Promise<AsyncIterable<Record<string, unknown>>>;

/** Mutable per-turn state threaded through the agentic loop. */
interface TurnState {
  referencesByPage: Map<number, Reference>;
  fallbackReference: Reference | null;
  citedCandidates: CitationCandidate[];
}

/**
 * `TutorService` backed by OpenAI.
 *
 * The model reads the document agentically: it calls `search_document` /
 * `get_page` / `get_outline` (run by {@link TutorToolExecutor}) and records
 * quotes via `cite_passages`. This class only drives that loop — request
 * assembly, stream decoding, reference selection, and marker reconciliation are
 * each delegated to a collaborator.
 */
export class OpenAiTutorService implements TutorService {
  private readonly client: OpenAI;
  private readonly requests: TutorRequestFactory;
  private readonly citePassages = new CitePassagesParser();
  private readonly streamReader = new OpenAiResponseStreamReader();
  private readonly logVerbose: boolean;

  constructor(
    config: EnvConfig,
    private readonly tools: TutorToolExecutor,
    private readonly referenceSelector: ReferenceSelector,
    private readonly markerReconciler: CitationMarkerReconciler
  ) {
    this.client = new OpenAI({ apiKey: config.OPENAI_API_KEY });
    this.requests = new TutorRequestFactory(config);
    this.logVerbose = config.TUTOR_LOG_VERBOSE;
  }

  async *streamReply(
    request: TutorReplyRequest,
    signal: AbortSignal
  ): AsyncGenerator<TutorStreamEvent> {
    const createResponse = this.bindCreateResponse();
    const settings = this.requests.settingsFor(request);
    const log = createTurnLogger(this.logVerbose);
    const state: TurnState = {
      referencesByPage: new Map(),
      fallbackReference: null,
      citedCandidates: []
    };

    log.info(
      `turn start — "${truncate(request.message)}" · model=${settings.model} ` +
        `· saveCost=${request.saveCost} · effort=${settings.reasoningEffort} ` +
        `· maxSteps=${settings.maxToolSteps} · history=${request.history.length} ` +
        `· pages=${request.pages.length} · chunks=${request.chunks.length}`
    );

    // First turn carries history + the student's message; later turns chain off
    // `previous_response_id` and carry only tool outputs.
    let pendingInput = this.requests.initialInput(request, settings);
    let previousResponseId: string | undefined;

    for (let step = 0; step < settings.maxToolSteps; step += 1) {
      log.info(
        `step ${step + 1}/${settings.maxToolSteps} → requesting model response` +
          (previousResponseId ? " (chained)" : "")
      );
      const stream = await createResponse(
        this.requests.body(request, settings, pendingInput, previousResponseId),
        { signal }
      );
      const { toolCalls, stepText, responseId } = await this.streamReader.read(stream);
      if (responseId) {
        previousResponseId = responseId;
      }
      log.info(
        `step ${step + 1} ← ${toolCalls.length} tool call(s)` +
          (toolCalls.length ? `: ${toolCalls.map((call) => call.name).join(", ")}` : "") +
          (stepText ? ` · ${stepText.length} chars of text` : "")
      );

      // No tool calls → the model has produced its final spoken answer.
      if (toolCalls.length === 0) {
        if (stepText) {
          log.info(`final answer (${stepText.length} chars): "${truncate(stepText)}"`);
          log.detail("final answer (full)", stepText);
          yield* this.emitAnswer(stepText, request, state, log);
        } else {
          log.warn("model returned neither tool calls nor text — ending turn");
        }
        return;
      }

      // Any text the model emitted alongside its tool calls — useful for tracing
      // its reasoning between steps.
      if (stepText) {
        log.detail("model interim text", stepText);
      }
      pendingInput = await this.runToolCalls(toolCalls, request, state, log);
    }

    log.warn(`reached maxToolSteps (${settings.maxToolSteps}) without a final answer`);
  }

  /** Resolves the reference, reconciles `[[N]]` markers, and emits the answer. */
  private *emitAnswer(
    stepText: string,
    request: TutorReplyRequest,
    state: TurnState,
    log: TurnLogger
  ): Generator<TutorStreamEvent> {
    const reference = this.referenceSelector.select({
      answer: stepText,
      referencesByPage: state.referencesByPage,
      fallback: state.fallbackReference,
      pages: request.pages,
      chunks: request.chunks,
      citedCandidates: state.citedCandidates
    });
    const aligned = this.markerReconciler.reconcile(stepText, reference);
    if (aligned.reference) {
      log.info(`citation → page ${aligned.reference.pageNumber}`);
      yield { type: "reference", reference: aligned.reference };
    }
    yield { type: "delta", text: aligned.text };
  }

  /** Runs each tool call and returns the function outputs for the next turn. */
  private async runToolCalls(
    toolCalls: ReadonlyArray<PendingToolCall>,
    request: TutorReplyRequest,
    state: TurnState,
    log: TurnLogger
  ): Promise<Record<string, unknown>[]> {
    const outputs: Record<string, unknown>[] = [];
    for (const call of toolCalls) {
      if (call.name === "cite_passages") {
        const recorded = this.citePassages.parse(call.args);
        state.citedCandidates.push(...recorded);
        log.info(`tool cite_passages → recorded ${recorded.length} citation(s)`);
        log.detail("cite_passages result", formatCitations(recorded));
        outputs.push(this.functionOutput(call.callId, this.citeMessage(recorded.length)));
        continue;
      }

      log.info(`tool ${call.name}(${truncate(call.args, 160)})`);
      const result = await this.tools.execute(call.name, call.args, request);
      log.info(
        `tool ${call.name} ← ${result.output.length} chars · ` +
          `${result.references.length} reference(s)`
      );
      log.detail(`${call.name} result`, result.output);
      for (const reference of result.references) {
        if (!state.referencesByPage.has(reference.pageNumber)) {
          state.referencesByPage.set(reference.pageNumber, reference);
        }
      }
      if (result.references[0]) {
        state.fallbackReference = result.references[0];
      }
      outputs.push(this.functionOutput(call.callId, result.output));
    }
    return outputs;
  }

  private citeMessage(count: number): string {
    return count
      ? `Recorded ${count} citation(s).`
      : "No usable citations were recorded — quotes must be exact substrings of the page text.";
  }

  private functionOutput(callId: string, output: string): Record<string, unknown> {
    return { type: "function_call_output", call_id: callId, output };
  }

  /** Binds `create` to keep `this` — a detached call loses its client. */
  private bindCreateResponse(): CreateResponse {
    return this.client.responses.create.bind(
      this.client.responses
    ) as unknown as CreateResponse;
  }
}

/** A turn-scoped logger; every line is tagged so concurrent turns stay legible. */
type TurnLogger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  /** Verbose-only: dump a step's full result (tool text, answer, …) as a block. */
  detail: (label: string, body: string) => void;
};

/**
 * Builds a {@link TurnLogger} tagged with a fresh short id, so the interleaved
 * step logs of simultaneous students can be told apart in the output. When
 * `verbose` is on, `detail` dumps the full result of each step as an indented
 * block; otherwise it is a no-op so only the concise step summaries show.
 */
function createTurnLogger(verbose: boolean): TurnLogger {
  const tag = `[tutor ${Math.random().toString(36).slice(2, 8)}]`;
  return {
    info: (message) => logger.info(`${tag} ${message}`),
    warn: (message) => logger.warn(`${tag} ${message}`),
    detail: (label, body) => {
      if (!verbose) return;
      logger.info(`${tag} ↳ ${label}:`, `\n${block(body)}`);
    }
  };
}

/** Collapses whitespace and clips to `max` chars for a single-line log preview. */
function truncate(text: string, max = 120): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > max ? `${collapsed.slice(0, max)}…` : collapsed;
}

/**
 * Indents a (possibly multi-line) value into a readable block for verbose logs,
 * clipping pathologically large bodies so a single trace can't flood the console.
 */
function block(body: string, max = 16000): string {
  const text =
    body.length > max
      ? `${body.slice(0, max)}\n… (${body.length - max} more characters truncated)`
      : body;
  return text
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");
}

/** Renders recorded citation candidates as `[page N] "quote"` lines. */
function formatCitations(candidates: ReadonlyArray<CitationCandidate>): string {
  if (candidates.length === 0) {
    return "(none — quotes must be exact substrings of the page text)";
  }
  return candidates
    .map((candidate) => `[page ${candidate.pageNumber}] "${candidate.quote}"`)
    .join("\n");
}
