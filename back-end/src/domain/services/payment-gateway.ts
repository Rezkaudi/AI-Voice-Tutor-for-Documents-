import type { SubscriptionStatus } from "@/domain/entities/subscription";

export type CheckoutMode = "subscription" | "payment";

export interface CheckoutSessionRequest {
  mode: CheckoutMode;
  priceId: string;
  customerId?: string | null;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}

export interface CheckoutSessionResult {
  id: string;
  url: string;
}

export interface RemoteSubscription {
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  priceId: string;
  metadata: Record<string, string>;
}

export type WebhookEvent =
  | {
    id: string;
    type: "checkout.session.completed";
    sessionId: string;
    mode: CheckoutMode;
    paymentIntentId: string | null;
    subscriptionId: string | null;
    customerId: string | null;
    metadata: Record<string, string>;
  }
  | { id: string; type: "checkout.session.expired"; sessionId: string }
  | {
    id: string;
    type: "invoice.paid";
    subscriptionId: string | null;
    customerId: string | null;
  }
  | {
    id: string;
    type: "customer.subscription.updated";
    subscriptionId: string;
  }
  | {
    id: string;
    type: "customer.subscription.deleted";
    subscriptionId: string;
  }
  | { id: string; type: "unhandled"; eventType: string };

export interface IPaymentGateway {
  createCheckoutSession(request: CheckoutSessionRequest): Promise<CheckoutSessionResult>;
  retrieveSubscription(stripeSubscriptionId: string): Promise<RemoteSubscription>;
  cancelSubscriptionAtPeriodEnd(stripeSubscriptionId: string): Promise<void>;
  resumeSubscription(stripeSubscriptionId: string): Promise<void>;
  constructWebhookEvent(rawBody: Buffer, signature: string): WebhookEvent;
}
