import type { SubscriptionStatus } from "@/domain/entities/subscription";
import type { RemoteSubscription, WebhookEvent } from "@/domain/services/payment-gateway";

import type {
  RawCheckoutSession,
  RawInvoice,
  RawSubscription,
  RawWebhookEvent
} from "./stripe.types";

/**
 * Anti-corruption layer that translates raw Stripe payloads into the domain's
 * payment-gateway DTOs. Pure and stateless: it performs no I/O and knows
 * nothing about the Stripe client, so it can be unit-tested in isolation.
 */
export class StripeMapper {
  toRemoteSubscription(sub: RawSubscription): RemoteSubscription {
    const item = sub.items.data[0];
    const periodStart = item?.current_period_start ?? sub.current_period_start ?? 0;
    const periodEnd = item?.current_period_end ?? sub.current_period_end ?? 0;

    return {
      stripeSubscriptionId: sub.id,
      stripeCustomerId: this.idOf(sub.customer) ?? "",
      status: this.mapSubscriptionStatus(sub.status),
      currentPeriodStart: new Date(periodStart * 1000).toISOString(),
      currentPeriodEnd: new Date(periodEnd * 1000).toISOString(),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      priceId: item?.price?.id ?? "",
      metadata: (sub.metadata as Record<string, string>) ?? {}
    };
  }

  toWebhookEvent(event: RawWebhookEvent): WebhookEvent {
    const object = event.data.object;

    switch (event.type) {
      case "checkout.session.completed": {
        const s = object as RawCheckoutSession;
        return {
          id: event.id,
          type: "checkout.session.completed",
          sessionId: String(s.id),
          mode: s.mode === "subscription" ? "subscription" : "payment",
          paymentIntentId: this.idOf(s.payment_intent),
          subscriptionId: this.idOf(s.subscription),
          customerId: this.idOf(s.customer),
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
          subscriptionId: this.idOf(this.invoiceSubscription(inv)),
          customerId: this.idOf(inv.customer)
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

  private idOf(ref: unknown): string | null {
    if (!ref) return null;
    if (typeof ref === "string") return ref;
    if (typeof ref === "object" && "id" in ref) {
      return String((ref as { id: string }).id);
    }
    return null;
  }

  private invoiceSubscription(inv: RawInvoice): unknown {
    if (inv.subscription) return inv.subscription;
    return inv.lines?.data?.[0]?.subscription ?? null;
  }

  private mapSubscriptionStatus(stripeStatus: string): SubscriptionStatus {
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
}
