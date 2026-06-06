import { ValidationError } from "@/domain/errors/app-error";
import type { TranscriptionService } from "@/domain/services/speech-services";
import type { Logger } from "@/domain/services/logger";
import { truncate } from "@/shared/logger";

/** A recorded clip submitted for transcription. */
export interface TranscribeAudioInput {
  readonly audio: Buffer;
  readonly filename: string;
  readonly contentType: string;
  readonly language?: string;
}

/** Transcribes a learner's recorded speech into text. */
export class TranscribeAudioUseCase {
  constructor(
    private readonly transcription: TranscriptionService,
    private readonly logger: Logger
  ) {}

  async execute(
    input: TranscribeAudioInput,
    signal?: AbortSignal
  ): Promise<{ text: string }> {
    const log = this.logger.scope("transcribe");
    if (input.audio.length === 0) {
      log.warn("rejected — no audio received");
      throw new ValidationError("No audio was received.");
    }

    log.info(
      `learner audio received · ${(input.audio.length / 1024).toFixed(1)} KiB · ` +
        `${input.contentType} · lang=${input.language ?? "auto"} → transcribing`
    );
    const text = (await this.transcription.transcribe(input, signal)).trim();
    log.info(`transcribed ${text.length} char(s): "${truncate(text)}"`);
    return { text };
  }
}
