import { Router } from "express";
import { asyncHandler } from "@/infrastructure/http/middleware/async-handler";
import type { SpeechController } from "@/infrastructure/http/controllers/speech.controller";
import { speakValidation } from "@/infrastructure/http/validations/speech.validation";

export function buildSpeechRoutes(controller: SpeechController): Router {
  const router = Router();

  router.post("/speak", speakValidation, asyncHandler(controller.speak));

  return router;
}
