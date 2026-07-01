import OpenAI from "openai";
import { UpstreamError } from "@/domain/errors/app-error";
import type { SpeechSynthesisService, SynthesizedSpeech } from "@/domain/services/speech-services";
import type { EnvConfig } from "@/config/env.config";
import { AUDIO_TOKENS_PER_TEXT_TOKEN, describe, estimateTokens } from "@/infrastructure/services/ai/openai-speech-shared";

export class OpenAiTextToSpeechService implements SpeechSynthesisService {
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
