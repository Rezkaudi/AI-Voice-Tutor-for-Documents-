import OpenAI, { toFile } from "openai";
import { UpstreamError } from "@/domain/errors/app-error";
import type {
  SpeechSynthesisService,
  SynthesizedSpeech,
  TranscriptionInput,
  TranscriptionResult,
  TranscriptionService
} from "@/domain/services/speech-services";
import type { EnvConfig } from "@/config/env.config";

const CHARS_PER_TOKEN = 4;

const AUDIO_TOKENS_PER_TEXT_TOKEN = 6;

const estimateTokens = (text: string): number =>
  Math.ceil(text.length / CHARS_PER_TOKEN);

/** Text-to-speech via OpenAI (`/api/speak`). */
export class OpenAiSpeechSynthesisService implements SpeechSynthesisService {
  private readonly client: OpenAI;

  constructor(private readonly config: EnvConfig) {
    this.client = new OpenAI({ apiKey: config.OPENAI_API_KEY });
  }

  async synthesize(text: string, signal?: AbortSignal): Promise<SynthesizedSpeech> {
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
      const inputTokens = estimateTokens(text);
      return {
        audio: Buffer.from(await response.arrayBuffer()),
        contentType: "audio/mpeg",
        usage: {
          model: this.config.OPENAI_SPEECH_MODEL,
          inputTokens,
          outputTokens: inputTokens * AUDIO_TOKENS_PER_TEXT_TOKEN
        }
      };
    } catch (error) {
      throw new UpstreamError(`Speech synthesis failed: ${describe(error)}`);
    }
  }
}

/** Speech-to-text via OpenAI (`/api/transcribe`). */
export class OpenAiTranscriptionService implements TranscriptionService {
  private readonly client: OpenAI;

  constructor(private readonly config: EnvConfig) {
    this.client = new OpenAI({ apiKey: config.OPENAI_API_KEY });
  }

  async transcribe(
    input: TranscriptionInput,
    signal?: AbortSignal
  ): Promise<TranscriptionResult> {
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
      const text = (result.text || "").trim();
      return {
        text,
        usage: this.transcriptionUsage(result, text)
      };
    } catch (error) {
      throw new UpstreamError(`Transcription failed: ${describe(error)}`);
    }
  }

  private transcriptionUsage(
    result: unknown,
    text: string
  ): { model: string; inputTokens: number; outputTokens: number } {
    const usage = (result as { usage?: Record<string, unknown> } | undefined)?.usage;
    const inputTokens = Number(usage?.input_tokens);
    const outputTokens = Number(usage?.output_tokens);
    if (Number.isFinite(inputTokens) || Number.isFinite(outputTokens)) {
      return {
        model: this.config.OPENAI_TRANSCRIBE_MODEL,
        inputTokens: Number.isFinite(inputTokens) ? inputTokens : 0,
        outputTokens: Number.isFinite(outputTokens) ? outputTokens : 0
      };
    }
    // No usage reported — estimate the audio (input) from the transcript length.
    return {
      model: this.config.OPENAI_TRANSCRIBE_MODEL,
      inputTokens: estimateTokens(text),
      outputTokens: estimateTokens(text)
    };
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
