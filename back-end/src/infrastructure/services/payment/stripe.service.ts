import Stripe from "stripe";
import type { EnvConfig } from "@/config/env.config";
import type { SubscriptionStatus } from "@/domain/entities/subscription";
import type { CheckoutSessionRequest, CheckoutSessionResult, IPaymentGateway, RemoteSubscription, WebhookEvent } from "@/domain/services/payment-gateway";

type StripeClient = InstanceType<typeof Stripe>;
type SessionCreateParams = Parameters<StripeClient["checkout"]["sessions"]["create"]>[0];

export class StripeService implements IPaymentGateway {
  private readonly stripe: StripeClient;
  private readonly webhookSecret: string;

  constructor(env: EnvConfig) {
    this.stripe = new Stripe(env.STRIPE_SECRET_KEY);
    this.webhookSecret = env.STRIPE_WEBHOOK_SECRET;
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
    return toRemoteSubscription(sub as unknown as RawSubscription);
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
    const object = event.data.object as unknown;

    switch (event.type) {
      case "checkout.session.completed": {
        const s = object as RawCheckoutSession;
        return {
          id: event.id,
          type: "checkout.session.completed",
          sessionId: String(s.id),
          mode: s.mode === "subscription" ? "subscription" : "payment",
          paymentIntentId: idOf(s.payment_intent),
          subscriptionId: idOf(s.subscription),
          customerId: idOf(s.customer),
          metadata: (s.metadata as Record<string, string>) ?? {}
        };
      }
      case "checkout.session.expired": {
        const s = object as RawCheckoutSession;
        return {
          id: event.id,
          type: "checkout.session.expired",
          sessionId: String(s.id)
        };
      }
      case "invoice.paid": {
        const inv = object as RawInvoice;
        return {
          id: event.id,
          type: "invoice.paid",
          subscriptionId: idOf(invoiceSubscription(inv)),
          customerId: idOf(inv.customer)
        };
      }
      case "customer.subscription.updated": {
        const sub = object as { id: string };
        return {
          id: event.id,
          type: "customer.subscription.updated",
          subscriptionId: sub.id
        };
      }
      case "customer.subscription.deleted": {
        const sub = object as { id: string };
        return {
          id: event.id,
          type: "customer.subscription.deleted",
          subscriptionId: sub.id
        };
      }
      default:
        return { id: event.id, type: "unhandled", eventType: event.type };
    }
  }
}

interface RawCheckoutSession {
  id: string;
  mode: string;
  payment_intent: unknown;
  subscription: unknown;
  customer: unknown;
  metadata: unknown;
}

interface RawInvoice {
  customer: unknown;
  subscription?: unknown;
  lines?: { data?: Array<{ subscription?: unknown }> };
}

interface RawSubscription {
  id: string;
  customer: unknown;
  status: string;
  cancel_at_period_end: boolean;
  metadata: unknown;
  current_period_start?: number;
  current_period_end?: number;
  items: {
    data: Array<{
      price?: { id?: string };
      current_period_start?: number;
      current_period_end?: number;
    }>;
  };
}

function idOf(ref: unknown): string | null {
  if (!ref) return null;
  if (typeof ref === "string") return ref;
  if (typeof ref === "object" && "id" in ref) {
    return String((ref as { id: string }).id);
  }
  return null;
}

function invoiceSubscription(inv: RawInvoice): unknown {
  if (inv.subscription) return inv.subscription;
  return inv.lines?.data?.[0]?.subscription ?? null;
}

function mapSubscriptionStatus(stripeStatus: string): SubscriptionStatus {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
      return "canceled";
    default:
      return "expired";
  }
}

function toRemoteSubscription(sub: RawSubscription): RemoteSubscription {
  const item = sub.items.data[0];
  const periodStart = item?.current_period_start ?? sub.current_period_start ?? 0;
  const periodEnd = item?.current_period_end ?? sub.current_period_end ?? 0;

  return {
    stripeSubscriptionId: sub.id,
    stripeCustomerId: idOf(sub.customer) ?? "",
    status: mapSubscriptionStatus(sub.status),
    currentPeriodStart: new Date(periodStart * 1000).toISOString(),
    currentPeriodEnd: new Date(periodEnd * 1000).toISOString(),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    priceId: item?.price?.id ?? "",
    metadata: (sub.metadata as Record<string, string>) ?? {}
  };
}
