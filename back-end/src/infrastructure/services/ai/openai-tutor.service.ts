import OpenAI from "openai";
import type { CitationCandidate } from "@/domain/logic/citation/citation-resolver";
import type { ReferenceSelector } from "@/domain/logic/citation/reference-selector";
import type { LearnerQuestionExtractor } from "@/domain/logic/question/learner-question-extractor";
import { StreamedReplySanitizer } from "@/domain/logic/streamed-reply-sanitizer";
import type { TutorReplyRequest, TutorService, TutorStreamEvent } from "@/domain/services/tutor-service";
import type { EnvConfig } from "@/config/env.config";
import type { Logger } from "@/domain/services/logger";
import { TutorRequestFactory } from "./tutor-request-factory";
import { CitationTrailerParser } from "@/domain/logic/citation/citation-trailer-parser";
import { OpenAiResponseStreamReader, type StreamStep } from "./openai-response-stream-reader";

type CreateResponse = (
  body: Record<string, unknown>,
  options: { signal: AbortSignal }
) => Promise<AsyncIterable<Record<string, unknown>>>;

export class OpenAiTutorService implements TutorService {
  private readonly client: OpenAI;
  private readonly requests: TutorRequestFactory;
  private readonly trailer = new CitationTrailerParser();
  private readonly streamReader = new OpenAiResponseStreamReader();

  constructor(
    config: EnvConfig,
    private readonly referenceSelector: ReferenceSelector,
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
    const citedCandidates: CitationCandidate[] = [];

    log.info(
      `turn start — "${this.logger.preview(request.message)}" · model=${settings.model} ` +
      `· effort=${settings.reasoningEffort} · history=${request.history.length} ` +
      `· pages=${request.pages.length}`
    );

    const input = this.requests.initialInput(request, settings);
    const sanitizer = new StreamedReplySanitizer();

    if (request.selectedPages.length > 0) {
      const lesson = input.find((item) => item.role === "developer");
      const chars = typeof lesson?.content === "string" ? lesson.content.length : 0;
      log.info(
        `lesson material → pages [${request.selectedPages.join(", ")}] injected ` +
        `as developer input · ${chars} chars`
      );
    }

    const stream = await createResponse(this.requests.body(settings, input, request), { signal });

    const streamReader = this.streamReader.read(stream);
    const iterator = streamReader[Symbol.asyncIterator]();
    let event: IteratorResult<TutorStreamEvent, StreamStep>;

    while (!(event = await iterator.next()).done) {
      const value = event.value;
      if (value.type === "delta") {
        const cleaned = sanitizer.push(value.text);
        if (cleaned) yield { type: "delta", text: cleaned };
      } else {
        yield value;
      }
    }

    const { stepText, usage } = event.value;
    const inputTokens = usage?.inputTokens ?? 0;
    const outputTokens = usage?.outputTokens ?? 0;
    const cachedInputTokens = usage?.cachedInputTokens ?? 0;

    if (stepText) {
      const { spokenText, candidates } = this.trailer.parse(stepText);
      if (candidates.length > 0) {
        citedCandidates.push(...candidates);
        log.info(`citations trailer → ${candidates.length} citation(s)`);
        log.detail("citations trailer", formatCitations(candidates));
      }
      log.info(
        `final answer (${spokenText.length} chars): "${this.logger.preview(spokenText)}"`
      );
      log.detail("final answer (full)", spokenText);

      const leftover = sanitizer.flush();
      if (leftover) {
        yield { type: "delta", text: leftover };
      }

      // Citations stay in trailer-label order so the streamed [[N]] markers
      // index them directly; the client reconciles once against the text it
      // actually displays.
      const reference = this.referenceSelector.select({
        pages: request.pages,
        citedCandidates
      });
      if (reference) {
        log.info(`citation → page ${reference.pageNumber}`);
        yield { type: "reference", reference };
      }

      if (/\[\[END\]\]/.test(stepText)) {
        log.info("learner asked to end the session → signalling end");
        yield { type: "end" };
      } else {
        const { question } = this.questionExtractor.extract(spokenText);
        if (question) {
          log.info(`learner question → "${this.logger.preview(question)}"`);
          yield { type: "question", text: question };
        }
      }
    } else {
      log.warn("model returned no text");
    }

    yield this.usageEvent(settings.model, inputTokens, outputTokens, cachedInputTokens, log);
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
