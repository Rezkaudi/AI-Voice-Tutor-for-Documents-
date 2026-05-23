import type { Request, Response } from "express";
import type { SynthesizeSpeechUseCase } from "@/application/use-cases/speech/synthesize-speech.use-case";

/** HTTP adapter for text-to-speech (`/api/speak`). */
export class SpeechController {
  constructor(private readonly synthesizeSpeech: SynthesizeSpeechUseCase) {}

  /** POST /api/speak — returns an audio clip for one sentence. */
  speak = async (req: Request, res: Response): Promise<void> => {
    const controller = new AbortController();
    req.on("close", () => controller.abort());

    const clip = await this.synthesizeSpeech.execute(
      req.body?.text,
      controller.signal
    );

    res.setHeader("Content-Type", clip.contentType);
    res.setHeader("Content-Length", clip.audio.length);
    res.send(clip.audio);
  };
}
