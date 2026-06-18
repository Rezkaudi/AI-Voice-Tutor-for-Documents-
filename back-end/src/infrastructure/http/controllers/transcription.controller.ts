import type { Request, Response } from "express";
import type { TranscribeAudioUseCase } from "@/application/use-cases/transcription/transcribe-audio.use-case";

/** HTTP adapter for speech-to-text (`/api/transcribe`). */
export class TranscriptionController {
  constructor(private readonly transcribeAudio: TranscribeAudioUseCase) { }

  /** POST /api/transcribe — accepts a multipart `audio` field. */
  transcribe = async (req: Request, res: Response): Promise<void> => {
    const file = req.file!;
    const language = req.body?.language as string | undefined;

    const controller = new AbortController();
    req.on("close", () => controller.abort());

    const result = await this.transcribeAudio.execute(
      req.auth!.userId,
      {
        audio: file.buffer,
        filename: file.originalname || "recording.webm",
        contentType: file.mimetype || "audio/webm",
        ...(language ? { language } : {})
      },
      controller.signal
    );
    res.json(result);
  };
}
