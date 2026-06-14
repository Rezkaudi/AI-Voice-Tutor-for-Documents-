import { getSubscriptionPlanByPriceId, DEFAULT_SUBSCRIPTION_PLAN } from "@/config/subscription-plans.config";

import { ValidationError } from "@/domain/errors/app-error";
import type { UserRepository } from "@/domain/repositories/user-repository";
import type { SubscriptionRepository } from "@/domain/repositories/subscription-repository";
import type { PaymentTransactionRepository } from "@/domain/repositories/payment-transaction-repository";
import type { IPaymentGateway, RemoteSubscription, WebhookEvent } from "@/domain/services/payment-gateway";
import type { IdGenerator } from "@/domain/services/id-generator";
import type { Logger } from "@/domain/services/logger";

import { todayKey } from "@/shared/date";

export class HandleStripeWebhookUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly paymentTransactionRepository: PaymentTransactionRepository,
    private readonly gateway: IPaymentGateway,
    private readonly idGenerator: IdGenerator,
    private readonly logger: Logger
  ) { }

  async execute(rawBody: Buffer, signature: string | undefined): Promise<void> {
    if (!signature) {
      throw new ValidationError("Missing Stripe signature.");
    }

    let event: WebhookEvent;
    try {
      event = this.gateway.constructWebhookEvent(rawBody, signature);
    } catch (error) {
      this.logger.scope("billing").warn("webhook signature verification failed");
      throw new ValidationError("Invalid webhook signature.");
    }

    const log = this.logger.scope("billing");
    log.info(`webhook ${event.type} (${event.id})`);

    switch (event.type) {
      case "checkout.session.completed":
        await this.onCheckoutCompleted(event);
        break;
      case "checkout.session.expired":
        await this.onCheckoutExpired(event.sessionId);
        break;
      case "invoice.paid":
        await this.onInvoicePaid(event.subscriptionId, event.customerId);
        break;
      case "customer.subscription.updated":
        await this.onSubscriptionUpdated(event.subscriptionId);
        break;
      case "customer.subscription.deleted":
        await this.onSubscriptionDeleted(event.subscriptionId);
        break;
      default:
        log.detail("webhook ignored", event.eventType);
    }
  }

  private async onCheckoutCompleted(event: Extract<WebhookEvent, { type: "checkout.session.completed" }>): Promise<void> {
    const log = this.logger.scope("billing");

    if (event.customerId && event.metadata.userId) {
      await this.userRepository.setStripeCustomerId(
        event.metadata.userId,
        event.customerId
      );
    }

    if (event.mode !== "payment") {
      return;
    }

    const txn = await this.paymentTransactionRepository.findByStripeSessionId(event.sessionId);

    if (!txn) {
      log.warn(`no transaction for session ${event.sessionId}`);
      return;
    }
    if (txn.status === "completed") {
      log.info(`session ${event.sessionId} already fulfilled — skipping`);
      return;
    }

    await this.userRepository.addTopupCredits(txn.userId, txn.creditsPurchased);
    await this.userRepository.markPurchased(txn.userId);
    await this.paymentTransactionRepository.markCompleted(txn.id, event.paymentIntentId, new Date().toISOString());

    log.info(`top-up fulfilled: +${txn.creditsPurchased} credits to user ${txn.userId}`);

  }

  private async onCheckoutExpired(sessionId: string): Promise<void> {
    const txn = await this.paymentTransactionRepository.findByStripeSessionId(sessionId);
    if (txn && txn.status === "pending") {
      await this.paymentTransactionRepository.markFailed(txn.id);
    }
  }

  private async onInvoicePaid(subscriptionId: string | null, customerId: string | null): Promise<void> {
    const log = this.logger.scope("billing");
    if (!subscriptionId) return;

    const remote = await this.gateway.retrieveSubscription(subscriptionId);
    const userId = await this.resolveUserId(remote, customerId);
    if (!userId) {
      log.warn(`invoice.paid: could not resolve user for sub ${subscriptionId}`);
      return;
    }

    const plan = getSubscriptionPlanByPriceId(remote.priceId) ?? DEFAULT_SUBSCRIPTION_PLAN;
    const existing = await this.subscriptionRepository.findByStripeSubscriptionId(subscriptionId);

    const samePeriod =
      existing?.currentPeriodStart === remote.currentPeriodStart &&
      existing?.status === "active";

    const now = new Date().toISOString();
    await this.subscriptionRepository.upsert({
      id: existing?.id ?? this.idGenerator.uuid(),
      userId,
      planId: plan.id,
      status: remote.status,
      stripeSubscriptionId: remote.stripeSubscriptionId,
      stripeCustomerId: remote.stripeCustomerId,
      currentPeriodStart: remote.currentPeriodStart,
      currentPeriodEnd: remote.currentPeriodEnd,
      dailyCreditsLimit: plan.dailyCreditsLimit,
      dailyCreditsUsed: samePeriod ? (existing?.dailyCreditsUsed ?? 0) : 0,
      lastUsageResetDate: samePeriod ? (existing?.lastUsageResetDate ?? todayKey()) : todayKey(),
      cancelAtPeriodEnd: remote.cancelAtPeriodEnd,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    });

    if (!samePeriod) {
      await this.userRepository.setSubscriptionCredits(userId, plan.credits);
      await this.userRepository.markPurchased(userId);
      if (remote.stripeCustomerId) {
        await this.userRepository.setStripeCustomerId(userId, remote.stripeCustomerId);
      }
      log.info(`subscription renewed: user ${userId} reset to ${plan.credits} credits`);
    } else {
      log.info(`invoice.paid for current period — credits unchanged`);
    }
  }

  private async onSubscriptionUpdated(subscriptionId: string): Promise<void> {
    const existing =
      await this.subscriptionRepository.findByStripeSubscriptionId(subscriptionId);
    if (!existing) {
      return;
    }
    const remote = await this.gateway.retrieveSubscription(subscriptionId);
    await this.subscriptionRepository.upsert({
      ...existing,
      status: remote.status,
      currentPeriodStart: remote.currentPeriodStart,
      currentPeriodEnd: remote.currentPeriodEnd,
      cancelAtPeriodEnd: remote.cancelAtPeriodEnd,
      updatedAt: new Date().toISOString()
    });
  }

  private async onSubscriptionDeleted(subscriptionId: string): Promise<void> {
    const existing = await this.subscriptionRepository.findByStripeSubscriptionId(subscriptionId);
    if (existing) {
      await this.subscriptionRepository.updateStatus(existing.id, "expired");
    }
  }

  private async resolveUserId(remote: RemoteSubscription, customerId: string | null): Promise<string | null> {
    if (remote.metadata.userId) return remote.metadata.userId;
    const cust = remote.stripeCustomerId || customerId;
    if (!cust) return null;
    const user = await this.userRepository.findByStripeCustomerId(cust);
    return user?.id ?? null;
  }
}
