import type { EnvConfig } from "@/config/env.config";
import { getSubscriptionPlan } from "@/config/subscription-plans.config";

import type { CheckoutUrlDto } from "@/application/dto/billing-dto";

import { NotFoundError, UnprocessableEntityError, UpstreamError } from "@/domain/errors/app-error";
import type { UserRepository } from "@/domain/repositories/user-repository";
import type { SubscriptionRepository } from "@/domain/repositories/subscription-repository";
import type { IPaymentGateway } from "@/domain/services/payment-gateway";
import type { Logger } from "@/domain/services/logger";


export class CreateSubscriptionCheckoutUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly gateway: IPaymentGateway,
    private readonly env: EnvConfig,
    private readonly logger: Logger
  ) { }

  async execute(userId: string, planId = "monthly"): Promise<CheckoutUrlDto> {
    const log = this.logger.scope("billing");
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found.");
    }

    const existing = await this.subscriptionRepository.findActiveByUserId(userId);
    if (existing) {
      throw new UnprocessableEntityError(
        "You already have an active subscription."
      );
    }

    const plan = getSubscriptionPlan(planId);
    if (!plan || !plan.priceId) {
      throw new UpstreamError("Subscription is not configured.");
    }

    try {
      const session = await this.gateway.createCheckoutSession({
        mode: "subscription",
        priceId: plan.priceId,
        customerId: user.stripeCustomerId,
        customerEmail: user.email,
        successUrl: this.env.BILLING_SUCCESS_URL,
        cancelUrl: this.env.BILLING_CANCEL_URL,
        metadata: { userId, planId: plan.id }
      });
      log.info(`subscription checkout started for user ${userId}`);
      return { url: session.url };
    } catch (error) {
      log.error("failed to create subscription checkout session", error);
      throw new UpstreamError("Could not start checkout.");
    }
  }
}
