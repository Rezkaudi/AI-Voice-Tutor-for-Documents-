import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "@/infrastructure/http/middleware/async-handler";
import type { TranscriptionController } from "@/infrastructure/http/controllers/transcription.controller";
import { transcribeValidation } from "@/infrastructure/http/validations/transcription.validation";

const AUDIO_LIMIT_BYTES = 8 * 1024 * 1024;

export function buildTranscriptionRoutes(
  controller: TranscriptionController
): Router {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: AUDIO_LIMIT_BYTES }
  });

  router.post(
    "/transcribe",
    upload.single("audio"),
    transcribeValidation,
    asyncHandler(controller.transcribe)
  );

  return router;
}
