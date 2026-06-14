import OpenAI, { toFile } from "openai";
import { UpstreamError } from "@/domain/errors/app-error";
import type {
  SpeechSynthesisService,
  SynthesizedSpeech,
  TranscriptionInput,
  TranscriptionService
} from "@/domain/services/speech-services";
import type { EnvConfig } from "@/config/env.config";
import type { CostCalculator } from "@/domain/logic/cost/cost-calculator";
import type { CostReporter } from "@/domain/services/cost-reporter";
import type { ICreditService } from "@/domain/services/credit-service";
import type { TranscriptionUsage } from "@/domain/logic/cost/cost";

/** Text-to-speech via OpenAI (`/api/speak`). */
export class OpenAiSpeechSynthesisService implements SpeechSynthesisService {
  private readonly client: OpenAI;

  constructor(
    private readonly config: EnvConfig,
    private readonly costCalculator: CostCalculator,
    private readonly costReporter: CostReporter,
    private readonly creditService: ICreditService
  ) {
    this.client = new OpenAI({ apiKey: config.OPENAI_API_KEY });
  }

  async synthesize(text: string, userId: string, signal?: AbortSignal): Promise<SynthesizedSpeech> {
    try {
      const response = await this.client.audio.speech.create(
        {
          model: this.config.OPENAI_SPEECH_MODEL,
          voice: this.config.OPENAI_SPEECH_VOICE,
          input: text,
          response_format: "mp3"
        },
        signal ? { signal } : {}
      );
      // TTS returns no usage payload — cost is estimated from the input text.
      const model = this.config.OPENAI_SPEECH_MODEL;
      const cost = this.costCalculator.speech(model, text);
      this.costReporter.report({
        operation: "speech",
        cost,
        context: `${text.length} char(s)`
      });
      await this.creditService.deductForUsage({ userId, usd: cost.usd });
      return {
        audio: Buffer.from(await response.arrayBuffer()),
        contentType: "audio/mpeg"
      };
    } catch (error) {
      throw new UpstreamError(`Speech synthesis failed: ${describe(error)}`);
    }
  }
}

/** Speech-to-text via OpenAI (`/api/transcribe`). */
export class OpenAiTranscriptionService implements TranscriptionService {
  private readonly client: OpenAI;

  constructor(
    private readonly config: EnvConfig,
    private readonly costCalculator: CostCalculator,
    private readonly costReporter: CostReporter,
    private readonly creditService: ICreditService
  ) {
    this.client = new OpenAI({ apiKey: config.OPENAI_API_KEY });
  }

  async transcribe(
    input: TranscriptionInput,
    signal?: AbortSignal
  ): Promise<string> {
    try {
      const file = await toFile(input.audio, input.filename, {
        type: input.contentType
      });
      const result = await this.client.audio.transcriptions.create(
        {
          model: this.config.OPENAI_TRANSCRIBE_MODEL,
          file,
          ...(input.language ? { language: input.language } : {})
        },
        signal ? { signal } : {}
      );
      await this.reportCost(result, input.audio.length, input.userId);
      return (result.text || "").trim();
    } catch (error) {
      throw new UpstreamError(`Transcription failed: ${describe(error)}`);
    }
  }

  /**
   * Reports STT cost and deducts it. Uses the model's exact token usage when
   * present; otherwise falls back to a byte-based estimate of audio input tokens.
   */
  private async reportCost(
    result: unknown,
    audioBytes: number,
    userId: string
  ): Promise<void> {
    const model = this.config.OPENAI_TRANSCRIBE_MODEL;
    const usage = parseTranscriptionUsage(result);
    const exact = usage !== undefined;
    const billed: TranscriptionUsage = usage ?? {
      audioInputTokens: this.costCalculator.estimateAudioTokens(model, audioBytes),
      textInputTokens: 0,
      outputTokens: 0
    };
    const cost = this.costCalculator.transcription(model, billed, !exact);
    this.costReporter.report({
      operation: "transcription",
      cost,
      context: exact ? "exact usage" : `~${(audioBytes / 1024).toFixed(1)} KiB est.`,
      meta: {
        audioInput: billed.audioInputTokens,
        textInput: billed.textInputTokens,
        output: billed.outputTokens
      }
    });
    await this.creditService.deductForUsage({ userId, usd: cost.usd });
  }
}

/** Reads the transcription `usage` block (token variant) if the model returned one. */
function parseTranscriptionUsage(result: unknown): TranscriptionUsage | undefined {
  if (!result || typeof result !== "object") return undefined;
  const usage = (result as Record<string, unknown>).usage as
    | Record<string, unknown>
    | undefined;
  if (!usage || usage.type !== "tokens") return undefined;
  const details = (usage.input_token_details as Record<string, unknown>) ?? {};
  return {
    audioInputTokens: num(details.audio_tokens),
    textInputTokens: num(details.text_tokens),
    outputTokens: num(usage.output_tokens)
  };
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
