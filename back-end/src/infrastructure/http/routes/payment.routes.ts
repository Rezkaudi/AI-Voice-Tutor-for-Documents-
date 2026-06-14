import { Router } from "express";
import express from "express";
import { asyncHandler } from "@/infrastructure/http/middleware/async-handler";
import type { PaymentController } from "@/infrastructure/http/controllers/payment.controller";

export function buildPaymentRoutes(controller: PaymentController): Router {
  const router = Router();
  router.post("/billing/checkout", asyncHandler(controller.checkout));
  router.get("/billing/balance", asyncHandler(controller.balance));
  router.get("/billing/status", asyncHandler(controller.status));
  return router;
}

export function buildStripeWebhookRoute(controller: PaymentController): Router {
  const router = Router();
  router.post(
    "/webhooks/stripe",
    express.raw({ type: "application/json" }),
    asyncHandler(controller.webhook)
  );
  return router;
}
