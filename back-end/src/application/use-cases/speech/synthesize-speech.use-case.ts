import { NotConfiguredError, ValidationError } from "@/domain/errors/app-error";
import type {
  SpeechSynthesisService,
  SynthesizedSpeech
} from "@/domain/services/speech-services";

/**
 * Synthesizes one sentence of tutor speech.
 *
 * When no TTS provider is configured a `NotConfiguredError` is thrown; the HTTP
 * layer turns that into a 501, and the front-end falls back to the browser's
 * built-in speech synthesis.
 */
export class SynthesizeSpeechUseCase {
  /** Hard cap so a runaway request cannot bill an unbounded TTS call. */
  private static readonly MAX_CHARS = 4000;

  constructor(private readonly speech: SpeechSynthesisService) {}

  async execute(text: unknown, signal?: AbortSignal): Promise<SynthesizedSpeech> {
    if (!this.speech.isAvailable()) {
      throw new NotConfiguredError("Text-to-speech is not configured.");
    }
    if (typeof text !== "string" || text.trim().length === 0) {
      throw new ValidationError("Text to speak is required.");
    }

    const clipped = text.trim().slice(0, SynthesizeSpeechUseCase.MAX_CHARS);
    return this.speech.synthesize(clipped, signal);
  }
}
