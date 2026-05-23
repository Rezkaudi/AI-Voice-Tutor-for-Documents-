import { ValidationError } from "@/domain/errors/app-error";
import type { TranscriptionService } from "@/domain/services/speech-services";

/** A recorded clip submitted for transcription. */
export interface TranscribeAudioInput {
  readonly audio: Buffer;
  readonly filename: string;
  readonly contentType: string;
  readonly language?: string;
}

/** Transcribes a learner's recorded speech into text. */
export class TranscribeAudioUseCase {
  constructor(private readonly transcription: TranscriptionService) {}

  async execute(
    input: TranscribeAudioInput,
    signal?: AbortSignal
  ): Promise<{ text: string }> {
    if (input.audio.length === 0) {
      throw new ValidationError("No audio was received.");
    }

    const text = await this.transcription.transcribe(input, signal);
    return { text: text.trim() };
  }
}
