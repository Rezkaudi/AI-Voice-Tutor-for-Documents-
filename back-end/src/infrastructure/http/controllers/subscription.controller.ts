import type { Request, Response } from "express";

import type { CreateSubscriptionCheckoutUseCase } from "@/application/use-cases/subscription/create-subscription-checkout.use-case";
import type { GetSubscriptionStatusUseCase } from "@/application/use-cases/subscription/get-subscription-status.use-case";
import type { CancelSubscriptionUseCase } from "@/application/use-cases/subscription/cancel-subscription.use-case";
import type { ResumeSubscriptionUseCase } from "@/application/use-cases/subscription/resume-subscription.use-case";
import type { GetAvailablePlansUseCase } from "@/application/use-cases/subscription/get-available-plans.use-case";

export class SubscriptionController {
  constructor(
    private readonly createSubscriptionCheckout: CreateSubscriptionCheckoutUseCase,
    private readonly getSubscriptionStatus: GetSubscriptionStatusUseCase,
    private readonly cancelSubscription: CancelSubscriptionUseCase,
    private readonly resumeSubscription: ResumeSubscriptionUseCase,
    private readonly getAvailablePlans: GetAvailablePlansUseCase
  ) { }

  checkout = async (req: Request, res: Response): Promise<void> => {
    const planId = typeof req.body?.planId === "string" ? req.body.planId : undefined;
    res.json(await this.createSubscriptionCheckout.execute(req.auth!.userId, planId));
  };

  status = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.getSubscriptionStatus.execute(req.auth!.userId));
  };

  cancel = async (req: Request, res: Response): Promise<void> => {
    await this.cancelSubscription.execute(req.auth!.userId);
    res.status(204).end();
  };

  resume = async (req: Request, res: Response): Promise<void> => {
    await this.resumeSubscription.execute(req.auth!.userId);
    res.status(204).end();
  };

  plans = async (_req: Request, res: Response): Promise<void> => {
    res.json({ plans: this.getAvailablePlans.execute() });
  };
}
