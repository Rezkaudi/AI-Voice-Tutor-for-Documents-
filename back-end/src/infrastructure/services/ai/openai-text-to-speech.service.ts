import OpenAI from "openai";
import { UpstreamError } from "@/domain/errors/app-error";
import type {
  SpeechSynthesisService,
  SynthesizedSpeech,
  SynthesizedSpeechStream
} from "@/domain/services/speech-services";
import type { EnvConfig } from "@/config/env.config";
import { AUDIO_TOKENS_PER_TEXT_TOKEN, describe, estimateTokens } from "@/infrastructure/services/ai/openai-speech-shared";

export class OpenAiTextToSpeechService implements SpeechSynthesisService {
  private readonly client: OpenAI;

  constructor(private readonly config: EnvConfig) {
    this.client = new OpenAI({ apiKey: config.OPENAI_API_KEY });
  }

  async synthesize(text: string, signal?: AbortSignal): Promise<SynthesizedSpeech> {
    try {
      const response = await this.createSpeech(text, signal);
      return {
        audio: Buffer.from(await response.arrayBuffer()),
        contentType: "audio/mpeg",
        usage: this.usageFor(text)
      };
    } catch (error) {
      throw new UpstreamError(`Speech synthesis failed: ${describe(error)}`);
    }
  }

  async synthesizeStream(text: string, signal?: AbortSignal): Promise<SynthesizedSpeechStream> {
    try {
      const response = await this.createSpeech(text, signal);
      if (!response.body) {
        throw new Error("speech response has no body");
      }
      return {
        audio: readChunks(response.body),
        contentType: "audio/mpeg",
        usage: this.usageFor(text)
      };
    } catch (error) {
      throw new UpstreamError(`Speech synthesis failed: ${describe(error)}`);
    }
  }

  private createSpeech(text: string, signal?: AbortSignal): Promise<Response> {
    return this.client.audio.speech.create(
      {
        model: this.config.OPENAI_SPEECH_MODEL,
        voice: this.config.OPENAI_SPEECH_VOICE,
        input: text,
        response_format: "mp3"
      },
      signal ? { signal } : {}
    );
  }

  private usageFor(text: string) {
    const inputTokens = estimateTokens(text);
    return {
      model: this.config.OPENAI_SPEECH_MODEL,
      inputTokens,
      outputTokens: inputTokens * AUDIO_TOKENS_PER_TEXT_TOKEN
    };
  }
}

async function* readChunks(body: ReadableStream<Uint8Array>): AsyncGenerator<Buffer> {
  const reader = body.getReader();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      if (value && value.length > 0) yield Buffer.from(value);
    }
  } finally {
    reader.releaseLock();
  }
}
