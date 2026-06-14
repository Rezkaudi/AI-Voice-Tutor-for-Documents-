import { Router } from "express";
import { asyncHandler } from "@/infrastructure/http/middleware/async-handler";
import type { SubscriptionController } from "@/infrastructure/http/controllers/subscription.controller";

export function buildSubscriptionRoutes(controller: SubscriptionController): Router {

  const router = Router();
  router.get("/billing/plans", asyncHandler(controller.plans));
  router.post("/billing/subscription/checkout", asyncHandler(controller.checkout));
  router.get("/billing/subscription/status", asyncHandler(controller.status));
  router.post("/billing/subscription/cancel", asyncHandler(controller.cancel));
  router.post("/billing/subscription/resume", asyncHandler(controller.resume));

  return router;
}
