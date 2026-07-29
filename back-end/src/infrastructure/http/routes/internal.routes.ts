import { Router, type RequestHandler } from "express";

import { asyncHandler } from "@/infrastructure/http/middleware/async-handler";
import type { InternalController } from "@/infrastructure/http/controllers/internal.controller";

export function buildInternalRoutes(
  controller: InternalController,
  requireWorkerToken: RequestHandler
): Router {
  const router = Router();

  router.post(
    "/extraction/run",
    requireWorkerToken,
    asyncHandler(controller.runExtraction)
  );

  return router;
}
