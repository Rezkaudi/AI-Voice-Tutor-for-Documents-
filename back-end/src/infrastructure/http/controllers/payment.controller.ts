import type { Request, Response } from "express";

import { ValidationError } from "@/domain/errors/app-error";

import type { CreateCheckoutSessionUseCase } from "@/application/use-cases/payment/create-checkout-session.use-case";
import type { HandleStripeWebhookUseCase } from "@/application/use-cases/payment/handle-stripe-webhook.use-case";
import type { GetUserBalanceUseCase } from "@/application/use-cases/payment/get-user-balance.use-case";
import type { PollPaymentStatusUseCase } from "@/application/use-cases/payment/poll-payment-status.use-case";

export class PaymentController {
  constructor(
    private readonly createCheckoutSession: CreateCheckoutSessionUseCase,
    private readonly handleStripeWebhook: HandleStripeWebhookUseCase,
    private readonly getUserBalance: GetUserBalanceUseCase,
    private readonly pollPaymentStatus: PollPaymentStatusUseCase
  ) { }

  checkout = async (req: Request, res: Response): Promise<void> => {
    const packageId = typeof req.body?.packageId === "string" ? req.body.packageId : undefined;
    res.json(await this.createCheckoutSession.execute(req.auth!.userId, packageId));
  };

  balance = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.getUserBalance.execute(req.auth!.userId));
  };

  status = async (req: Request, res: Response): Promise<void> => {
    const sessionId = req.query.sessionId;
    if (typeof sessionId !== "string" || !sessionId) {
      throw new ValidationError("sessionId is required.");
    }
    res.json(await this.pollPaymentStatus.execute(req.auth!.userId, sessionId));
  };

  webhook = async (req: Request, res: Response): Promise<void> => {
    const signature = req.headers["stripe-signature"];
    await this.handleStripeWebhook.execute(
      req.body as Buffer,
      typeof signature === "string" ? signature : undefined
    );
    res.json({ received: true });
  };
}
