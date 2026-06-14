import { Router, type RequestHandler } from "express";
import { asyncHandler } from "@/infrastructure/http/middleware/async-handler";
import type { SpeechController } from "@/infrastructure/http/controllers/speech.controller";
import { speakValidation } from "@/infrastructure/http/validations/speech.validation";

export function buildSpeechRoutes(controller: SpeechController, requireCredits: RequestHandler): Router {
  const router = Router();

  router.post(
    "/speak",
    requireCredits,
    speakValidation,
    asyncHandler(controller.speak)
  );

  return router;
}
