import OpenAI, { toFile } from "openai";
import { UpstreamError } from "@/domain/errors/app-error";
import type {
  SpeechSynthesisService,
  SynthesizedSpeech,
  TranscriptionInput,
  TranscriptionService
} from "@/domain/services/speech-services";
import type { EnvConfig } from "@/config/env.config";

/**
 * OpenAI-backed voice services.
 *
 * Both report `isAvailable() === false` when no API key is set; the front-end
 * then falls back to the browser's native speech APIs.
 */

function makeClient(apiKey: string): OpenAI | null {
  return apiKey ? new OpenAI({ apiKey }) : null;
}

/** Text-to-speech via OpenAI (`/api/speak`). */
export class OpenAiSpeechSynthesisService implements SpeechSynthesisService {
  private readonly client: OpenAI | null;

  constructor(private readonly config: EnvConfig) {
    this.client = makeClient(config.OPENAI_API_KEY);
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async synthesize(text: string, signal?: AbortSignal): Promise<SynthesizedSpeech> {
    if (!this.client) {
      throw new UpstreamError("Text-to-speech is not configured.");
    }
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
  private readonly client: OpenAI | null;

  constructor(private readonly config: EnvConfig) {
    this.client = makeClient(config.OPENAI_API_KEY);
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async transcribe(
    input: TranscriptionInput,
    signal?: AbortSignal
  ): Promise<string> {
    if (!this.client) {
      throw new UpstreamError("Transcription is not configured.");
    }
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
      return (result.text || "").trim();
    } catch (error) {
      throw new UpstreamError(`Transcription failed: ${describe(error)}`);
    }
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
