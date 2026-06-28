import { ValidationError } from "@/domain/errors/app-error";
import type { SpeechSynthesisService, SynthesizedSpeech } from "@/domain/services/speech-services";
import type { Logger } from "@/domain/services/logger";
import type { CostTracker } from "@/application/services/cost-tracker";

export class SynthesizeSpeechUseCase {
  private static readonly MAX_CHARS = 4000;

  constructor(
    private readonly speech: SpeechSynthesisService,
    private readonly costTracker: CostTracker,
    private readonly logger: Logger
  ) { }

  async execute(userId: string, text: unknown, signal?: AbortSignal): Promise<SynthesizedSpeech> {
    const log = this.logger.scope("speak");
    if (typeof text !== "string" || text.trim().length === 0) {
      log.warn("rejected — text to speak is required");
      throw new ValidationError("Text to speak is required.");
    }

    const clipped = text.trim().slice(0, SynthesizeSpeechUseCase.MAX_CHARS);
    log.info(`synthesizing ${clipped.length} char(s): "${log.preview(clipped)}"`);
    const clip = await this.speech.synthesize(clipped, signal);
    log.info(
      `speech ready · ${(clip.audio.length / 1024).toFixed(1)} KiB ${clip.contentType}`
    );
    await this.costTracker.track(userId, clip.usage);
    return clip;
  }
}
