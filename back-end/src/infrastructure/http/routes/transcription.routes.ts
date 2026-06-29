import { Router } from "express";

import { asyncHandler } from "@/infrastructure/http/middleware/async-handler";
import { audioUpload } from "@/infrastructure/http/middleware/audio-upload";
import type { TranscriptionController } from "@/infrastructure/http/controllers/transcription.controller";
import { transcribeValidation } from "@/infrastructure/http/validations/transcription.validation";

export function buildTranscriptionRoutes(
  controller: TranscriptionController
): Router {
  const router = Router();

  router.post(
    "/transcribe",
    audioUpload.single("audio"),
    transcribeValidation,
    asyncHandler(controller.transcribe)
  );

  return router;
}
