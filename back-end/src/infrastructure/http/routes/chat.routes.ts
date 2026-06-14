import { Router, type RequestHandler } from "express";
import { asyncHandler } from "@/infrastructure/http/middleware/async-handler";
import type { ChatController } from "@/infrastructure/http/controllers/chat.controller";
import { streamChatValidation } from "@/infrastructure/http/validations/chat.validation";

export function buildChatRoutes(controller: ChatController, requireCredits: RequestHandler): Router {
  const router = Router();

  router.post(
    "/chat",
    requireCredits,
    streamChatValidation,
    asyncHandler(controller.stream)
  );

  return router;
}
