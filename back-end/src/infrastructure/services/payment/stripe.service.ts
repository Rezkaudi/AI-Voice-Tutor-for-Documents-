import Stripe from "stripe";

import type { EnvConfig } from "@/config/env.config";
import type {
  CheckoutSessionRequest,
  CheckoutSessionResult,
  IPaymentGateway,
  RemoteSubscription,
  WebhookEvent
} from "@/domain/services/payment-gateway";

import { StripeMapper } from "./stripe.mapper";
import type { RawSubscription } from "./stripe.types";

type StripeClient = InstanceType<typeof Stripe>;
type SessionCreateParams = Parameters<StripeClient["checkout"]["sessions"]["create"]>[0];

export class StripeService implements IPaymentGateway {
  private readonly stripe: StripeClient;
  private readonly webhookSecret: string;
  private readonly mapper: StripeMapper;

  constructor(env: EnvConfig, mapper: StripeMapper = new StripeMapper()) {
    this.stripe = new Stripe(env.STRIPE_SECRET_KEY);
    this.webhookSecret = env.STRIPE_WEBHOOK_SECRET;
    this.mapper = mapper;
  }

  async createCheckoutSession(request: CheckoutSessionRequest): Promise<CheckoutSessionResult> {
    const params: SessionCreateParams = {
      mode: request.mode,
      line_items: [{ price: request.priceId, quantity: 1 }],
      success_url: request.successUrl,
      cancel_url: request.cancelUrl,
      metadata: request.metadata
    };

    if (request.customerId) {
      params.customer = request.customerId;
    } else if (request.customerEmail) {
      params.customer_email = request.customerEmail;
    }

    if (request.mode === "subscription") {
      params.subscription_data = { metadata: request.metadata };
    } else {
      params.payment_intent_data = { metadata: request.metadata };
    }

    const session = await this.stripe.checkout.sessions.create(params);
    return { id: session.id, url: session.url ?? "" };
  }

  async retrieveSubscription(stripeSubscriptionId: string): Promise<RemoteSubscription> {
    const sub = await this.stripe.subscriptions.retrieve(stripeSubscriptionId, {
      expand: ["items.data.price"]
    });
    return this.mapper.toRemoteSubscription(sub as unknown as RawSubscription);
  }

  async cancelSubscriptionAtPeriodEnd(stripeSubscriptionId: string): Promise<void> {
    await this.stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true
    });
  }

  async resumeSubscription(stripeSubscriptionId: string): Promise<void> {
    await this.stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: false
    });
  }

  constructWebhookEvent(rawBody: Buffer, signature: string): WebhookEvent {
    const event = this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      this.webhookSecret
    );
    return this.mapper.toWebhookEvent(event);
  }
}
