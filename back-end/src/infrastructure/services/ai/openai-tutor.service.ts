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

  constructor(
    config: EnvConfig,
    private readonly tools: TutorToolExecutor,
    private readonly referenceSelector: ReferenceSelector,
    private readonly markerReconciler: CitationMarkerReconciler
  ) {
    this.client = new OpenAI({ apiKey: config.OPENAI_API_KEY });
    this.requests = new TutorRequestFactory(config);
  }

  async *streamReply(
    request: TutorReplyRequest,
    signal: AbortSignal
  ): AsyncGenerator<TutorStreamEvent> {
    const createResponse = this.bindCreateResponse();
    const settings = this.requests.settingsFor(request);
    const state: TurnState = {
      referencesByPage: new Map(),
      fallbackReference: null,
      citedCandidates: []
    };

    // First turn carries history + the student's message; later turns chain off
    // `previous_response_id` and carry only tool outputs.
    let pendingInput = this.requests.initialInput(request, settings);
    let previousResponseId: string | undefined;

    for (let step = 0; step < settings.maxToolSteps; step += 1) {
      const stream = await createResponse(
        this.requests.body(request, settings, pendingInput, previousResponseId),
        { signal }
      );
      const { toolCalls, stepText, responseId } = await this.streamReader.read(stream);
      if (responseId) {
        previousResponseId = responseId;
      }

      // No tool calls → the model has produced its final spoken answer.
      if (toolCalls.length === 0) {
        if (stepText) {
          yield* this.emitAnswer(stepText, request, state);
        }
        return;
      }

      pendingInput = await this.runToolCalls(toolCalls, request, state);
    }
  }

  /** Resolves the reference, reconciles `[[N]]` markers, and emits the answer. */
  private *emitAnswer(
    stepText: string,
    request: TutorReplyRequest,
    state: TurnState
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
      yield { type: "reference", reference: aligned.reference };
    }
    yield { type: "delta", text: aligned.text };
  }

  /** Runs each tool call and returns the function outputs for the next turn. */
  private async runToolCalls(
    toolCalls: ReadonlyArray<PendingToolCall>,
    request: TutorReplyRequest,
    state: TurnState
  ): Promise<Record<string, unknown>[]> {
    const outputs: Record<string, unknown>[] = [];
    for (const call of toolCalls) {
      if (call.name === "cite_passages") {
        const recorded = this.citePassages.parse(call.args);
        state.citedCandidates.push(...recorded);
        outputs.push(this.functionOutput(call.callId, this.citeMessage(recorded.length)));
        continue;
      }

      const result = await this.tools.execute(call.name, call.args, request);
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
