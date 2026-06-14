import type { EnvConfig } from "@/config/env.config";
import { getCreditPackage } from "@/config/credit-packages.config";

import type { CheckoutUrlDto } from "@/application/dto/billing-dto";

import { NotFoundError, UpstreamError } from "@/domain/errors/app-error";
import type { UserRepository } from "@/domain/repositories/user-repository";
import type { PaymentTransactionRepository } from "@/domain/repositories/payment-transaction-repository";
import type { IPaymentGateway } from "@/domain/services/payment-gateway";
import type { IdGenerator } from "@/domain/services/id-generator";
import type { Logger } from "@/domain/services/logger";

export class CreateCheckoutSessionUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly paymentTransactionRepository: PaymentTransactionRepository,
    private readonly gateway: IPaymentGateway,
    private readonly idGenerator: IdGenerator,
    private readonly env: EnvConfig,
    private readonly logger: Logger
  ) { }

  async execute(userId: string, packageId = "topup"): Promise<CheckoutUrlDto> {
    const log = this.logger.scope("billing");
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found.");
    }

    const pkg = getCreditPackage(packageId);
    if (!pkg || !pkg.priceId) {
      throw new UpstreamError("Top-up is not configured.");
    }

    let session;
    try {
      session = await this.gateway.createCheckoutSession({
        mode: "payment",
        priceId: pkg.priceId,
        customerId: user.stripeCustomerId,
        customerEmail: user.email,
        successUrl: this.env.BILLING_SUCCESS_URL,
        cancelUrl: this.env.BILLING_CANCEL_URL,
        metadata: { userId, packageId: pkg.id }
      });
    } catch (error) {
      log.error("failed to create top-up checkout session", error);
      throw new UpstreamError("Could not start checkout.");
    }

    await this.paymentTransactionRepository.save({
      id: this.idGenerator.uuid(),
      userId,
      stripeSessionId: session.id,
      stripePaymentIntentId: null,
      packageName: pkg.name,
      creditsPurchased: pkg.credits,
      amountPaid: pkg.amount,
      currency: pkg.currency,
      status: "pending",
      createdAt: new Date().toISOString(),
      completedAt: null
    });

    log.info(`top-up checkout started for user ${userId} · session ${session.id}`);
    return { url: session.url };
  }
}
