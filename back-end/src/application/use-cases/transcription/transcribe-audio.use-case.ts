import { ValidationError } from "@/domain/errors/app-error";
import type { TranscriptionService } from "@/domain/services/speech-services";
import type { Logger } from "@/domain/services/logger";
import type { CostTracker } from "@/application/services/cost-tracker";

export interface TranscribeAudioInput {
  readonly audio: Buffer;
  readonly filename: string;
  readonly contentType: string;
  readonly language?: string;
}

export class TranscribeAudioUseCase {
  constructor(
    private readonly transcription: TranscriptionService,
    private readonly costTracker: CostTracker,
    private readonly logger: Logger
  ) { }

  async execute(userId: string, input: TranscribeAudioInput, signal?: AbortSignal): Promise<{ text: string }> {

    const log = this.logger.scope("transcribe");
    if (input.audio.length === 0) {
      log.warn("rejected — no audio received");
      throw new ValidationError("No audio was received.");
    }

    log.info(
      `learner audio received · ${(input.audio.length / 1024).toFixed(1)} KiB · ` +
      `${input.contentType} · lang=${input.language ?? "auto"} → transcribing`
    );
    const result = await this.transcription.transcribe(input, signal);
    const text = result.text.trim();
    log.info(`transcribed ${text.length} char(s): "${log.preview(text)}"`);
    await this.costTracker.track(userId, result.usage);
    return { text };
  }
}
