/**
 * Raw Stripe payload shapes used at the anti-corruption boundary.
 *
 * These describe only the fields we read from Stripe responses/webhooks so the
 * rest of the codebase never depends on Stripe's SDK types directly. They are
 * translated into domain DTOs by {@link StripeMapper}.
 */

export interface RawCheckoutSession {
  id: string;
  mode: string;
  payment_intent: unknown;
  subscription: unknown;
  customer: unknown;
  metadata: unknown;
}

export interface RawInvoice {
  customer: unknown;
  subscription?: unknown;
  lines?: { data?: Array<{ subscription?: unknown }> };
}

export interface RawSubscription {
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

/** Minimal shape of a verified Stripe webhook event we translate. */
export interface RawWebhookEvent {
  id: string;
  type: string;
  data: { object: unknown };
}
