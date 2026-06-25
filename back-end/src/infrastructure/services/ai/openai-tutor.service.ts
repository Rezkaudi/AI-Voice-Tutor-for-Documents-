import OpenAI from "openai";
import type { Reference } from "@/domain/entities/chat";
import type { CitationCandidate } from "@/domain/logic/citation-resolver";
import type { ReferenceSelector } from "@/domain/logic/citation/reference-selector";
import type { CitationMarkerReconciler } from "@/domain/logic/citation/citation-marker-reconciler";
import type { LearnerQuestionExtractor } from "@/domain/logic/question/learner-question-extractor";
import type { TutorReplyRequest, TutorService, TutorStreamEvent } from "@/domain/services/tutor-service";
import type { EnvConfig } from "@/config/env.config";
import type { Logger } from "@/domain/services/logger";
import { TutorRequestFactory } from "./tutor-request-factory";
import { TutorToolExecutor } from "./tutor-tool-executor";
import { CitationTrailerParser } from "./citation-trailer-parser";
import { OpenAiResponseStreamReader, type PendingToolCall } from "./openai-response-stream-reader";
import { truncate } from "@/shared/logger";

type CreateResponse = (
  body: Record<string, unknown>,
  options: { signal: AbortSignal }
) => Promise<AsyncIterable<Record<string, unknown>>>;

interface TurnState {
  referencesByPage: Map<number, Reference>;
  fallbackReference: Reference | null;
  citedCandidates: CitationCandidate[];
}

export class OpenAiTutorService implements TutorService {
  private readonly client: OpenAI;
  private readonly requests: TutorRequestFactory;
  private readonly trailer = new CitationTrailerParser();
  private readonly streamReader = new OpenAiResponseStreamReader();

  constructor(
    config: EnvConfig,
    private readonly tools: TutorToolExecutor,
    private readonly referenceSelector: ReferenceSelector,
    private readonly markerReconciler: CitationMarkerReconciler,
    private readonly questionExtractor: LearnerQuestionExtractor,
    private readonly logger: Logger
  ) {
    this.client = new OpenAI({ apiKey: config.OPENAI_API_KEY });
    this.requests = new TutorRequestFactory(config);
  }

  async *streamReply(request: TutorReplyRequest, signal: AbortSignal): AsyncGenerator<TutorStreamEvent> {

    const createResponse = this.bindCreateResponse();
    const settings = this.requests.settingsFor(request);
    const log = this.logger.scope("tutor");
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

    let pendingInput = this.requests.initialInput(request, settings);
    let previousResponseId: string | undefined;

    let inputTokens = 0;
    let outputTokens = 0;
    let cachedInputTokens = 0;

    if (request.selectedPages.length > 0) {
      const lesson = pendingInput.find((item) => item.role === "developer");
      const chars = typeof lesson?.content === "string" ? lesson.content.length : 0;
      log.info(
        `lesson material → pages [${request.selectedPages.join(", ")}] injected ` +
        `as developer input · ${chars} chars`
      );
    }

    for (let step = 0; step < settings.maxToolSteps; step += 1) {
      log.info(
        `step ${step + 1}/${settings.maxToolSteps} → requesting model response` +
        (previousResponseId ? " (chained)" : "")
      );
      const stream = await createResponse(
        this.requests.body(request, settings, pendingInput, previousResponseId),
        { signal }
      );
      const { toolCalls, stepText, responseId, usage } =
        await this.streamReader.read(stream);
      if (responseId) {
        previousResponseId = responseId;
      }
      if (usage) {
        inputTokens += usage.inputTokens;
        outputTokens += usage.outputTokens;
        cachedInputTokens += usage.cachedInputTokens;
      }
      log.info(
        `step ${step + 1} ← ${toolCalls.length} tool call(s)` +
        (toolCalls.length ? `: ${toolCalls.map((call) => call.name).join(", ")}` : "") +
        (stepText ? ` · ${stepText.length} chars of text` : "")
      );

      if (toolCalls.length === 0) {
        if (stepText) {
          const { spokenText, candidates } = this.trailer.parse(stepText);
          if (candidates.length > 0) {
            state.citedCandidates.push(...candidates);
            log.info(`citations trailer → ${candidates.length} citation(s)`);
            log.detail("citations trailer", formatCitations(candidates));
          }
          log.info(
            `final answer (${spokenText.length} chars): "${truncate(spokenText)}"`
          );
          log.detail("final answer (full)", spokenText);
          yield* this.emitAnswer(spokenText, request, state, log);
        } else {
          log.warn("model returned neither tool calls nor text — ending turn");
        }
        yield this.usageEvent(
          settings.model,
          inputTokens,
          outputTokens,
          cachedInputTokens,
          log
        );
        return;
      }

      if (stepText) {
        log.detail("model interim text", stepText);
      }
      pendingInput = await this.runToolCalls(toolCalls, request, state, log);
    }

    log.warn(`reached maxToolSteps (${settings.maxToolSteps}) without a final answer`);
    yield this.usageEvent(
      settings.model,
      inputTokens,
      outputTokens,
      cachedInputTokens,
      log
    );
  }

  private usageEvent(
    model: string,
    inputTokens: number,
    outputTokens: number,
    cachedInputTokens: number,
    log: Logger
  ): TutorStreamEvent {
    log.info(
      `turn usage → model=${model} · in=${inputTokens} ` +
      `(cached ${cachedInputTokens}) · out=${outputTokens} tokens`
    );
    return {
      type: "usage",
      usage: { model, inputTokens, outputTokens, cachedInputTokens }
    };
  }

  private *emitAnswer(
    stepText: string,
    request: TutorReplyRequest,
    state: TurnState,
    log: Logger
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

    const { text, question } = this.questionExtractor.extract(aligned.text);
    if (question) {
      log.info(`learner question → "${truncate(question)}"`);
      yield { type: "question", text: question };
    }
    yield { type: "delta", text };
  }

  private async runToolCalls(
    toolCalls: ReadonlyArray<PendingToolCall>,
    request: TutorReplyRequest,
    state: TurnState,
    log: Logger
  ): Promise<Record<string, unknown>[]> {
    const outputs: Record<string, unknown>[] = [];
    for (const call of toolCalls) {
      log.info(`tool ${call.name}(${truncate(call.args, 160)})`);
      const result = await this.tools.execute(call.name, call.args, request, log);
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

  private functionOutput(callId: string, output: string): Record<string, unknown> {
    return { type: "function_call_output", call_id: callId, output };
  }

  private bindCreateResponse(): CreateResponse {
    return this.client.responses.create.bind(
      this.client.responses
    ) as unknown as CreateResponse;
  }
}

function formatCitations(candidates: ReadonlyArray<CitationCandidate>): string {
  if (candidates.length === 0) {
    return "(none — quotes must be exact substrings of the page text)";
  }
  return candidates
    .map((candidate) => `[page ${candidate.pageNumber}] "${candidate.quote}"`)
    .join("\n");
}
