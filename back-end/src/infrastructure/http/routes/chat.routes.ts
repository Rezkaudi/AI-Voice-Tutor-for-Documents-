import { Router } from "express";
import { asyncHandler } from "@/infrastructure/http/middleware/async-handler";
import type { ChatController } from "@/infrastructure/http/controllers/chat.controller";
import { streamChatValidation } from "@/infrastructure/http/validations/chat.validation";

export function buildChatRoutes(controller: ChatController): Router {
  const router = Router();

  router.post(
    "/chat",
    streamChatValidation,
    asyncHandler(controller.stream)
  );

  return router;
}
