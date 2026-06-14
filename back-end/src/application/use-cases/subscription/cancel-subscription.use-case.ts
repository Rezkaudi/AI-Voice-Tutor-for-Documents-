import { NotFoundError, UpstreamError } from "@/domain/errors/app-error";
import type { SubscriptionRepository } from "@/domain/repositories/subscription-repository";
import type { IPaymentGateway } from "@/domain/services/payment-gateway";
import type { Logger } from "@/domain/services/logger";

export class CancelSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly gateway: IPaymentGateway,
    private readonly logger: Logger
  ) { }

  async execute(userId: string): Promise<void> {
    const sub = await this.subscriptionRepository.findActiveByUserId(userId);
    if (!sub) {
      throw new NotFoundError("No active subscription to cancel.");
    }

    try {
      await this.gateway.cancelSubscriptionAtPeriodEnd(sub.stripeSubscriptionId);
    } catch (error) {
      this.logger.scope("billing").error("failed to cancel subscription", error);
      throw new UpstreamError("Could not cancel the subscription.");
    }

    await this.subscriptionRepository.upsert({
      ...sub,
      cancelAtPeriodEnd: true,
      updatedAt: new Date().toISOString()
    });
  }
}
