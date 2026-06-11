import { Router, type RequestHandler } from "express";
import { asyncHandler } from "@/infrastructure/http/middleware/async-handler";
import type { AuthController } from "@/infrastructure/http/controllers/auth.controller";

export function buildAuthRoutes(
  controller: AuthController,
  requireAuth: RequestHandler
): Router {
  const router = Router();

  router.get("/auth/google", controller.start);
  router.get("/auth/google/callback", asyncHandler(controller.callback));
  router.post("/auth/refresh", asyncHandler(controller.refresh));
  router.get("/auth/me", requireAuth, asyncHandler(controller.me));
  router.post("/auth/logout", controller.logout);

  return router;
}
