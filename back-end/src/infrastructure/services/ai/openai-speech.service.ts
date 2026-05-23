import OpenAI, { toFile } from "openai";
import { UpstreamError } from "@/domain/errors/app-error";
import type {
  SpeechSynthesisService,
  SynthesizedSpeech,
  TranscriptionInput,
  TranscriptionService
} from "@/domain/services/speech-services";
import type { EnvConfig } from "@/config/env.config";

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

  constructor(private readonly config: EnvConfig) {
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
      return (result.text || "").trim();
    } catch (error) {
      throw new UpstreamError(`Transcription failed: ${describe(error)}`);
    }
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
