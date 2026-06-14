import { NotFoundError, UpstreamError } from "@/domain/errors/app-error";
import type { SubscriptionRepository } from "@/domain/repositories/subscription-repository";
import type { IPaymentGateway } from "@/domain/services/payment-gateway";
import type { Logger } from "@/domain/services/logger";

export class ResumeSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly gateway: IPaymentGateway,
    private readonly logger: Logger
  ) { }

  async execute(userId: string): Promise<void> {
    const sub = await this.subscriptionRepository.findActiveByUserId(userId);
    if (!sub) {
      throw new NotFoundError("No active subscription to resume.");
    }

    try {
      await this.gateway.resumeSubscription(sub.stripeSubscriptionId);
    } catch (error) {
      this.logger.scope("billing").error("failed to resume subscription", error);
      throw new UpstreamError("Could not resume the subscription.");
    }

    await this.subscriptionRepository.upsert({
      ...sub,
      cancelAtPeriodEnd: false,
      updatedAt: new Date().toISOString()
    });
  }
}
