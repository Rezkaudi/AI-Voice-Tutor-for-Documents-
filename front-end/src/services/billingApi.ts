import { api, extractErrorMessage } from "@/services/apiBase";

export interface Balance {
  creditBalance: number;
  subscriptionCredits: number;
  topupCredits: number;
  hasPurchased: boolean;
}

export interface SubscriptionStatus {
  active: boolean;
  status: "active" | "canceled" | "past_due" | "expired" | null;
  planId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  dailyCreditsLimit: number | null;
  dailyCreditsUsed: number | null;
  dailyCreditsRemaining: number | null;
}

export interface PlanOption {
  id: string;
  name: string;
  credits: number;
  amount: number;
  currency: string;
  recurring: boolean;
}

export async function getBalance(): Promise<Balance> {
  const { data } = await api.get<Balance>("/api/billing/balance");
  return data;
}

export async function getPlans(): Promise<PlanOption[]> {
  const { data } = await api.get<{ plans: PlanOption[] }>("/api/billing/plans");
  return data.plans;
}

export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  const { data } = await api.get<SubscriptionStatus>(
    "/api/billing/subscription/status"
  );
  return data;
}

/** Starts a one-time top-up and redirects the browser to Stripe Checkout. */
export async function startTopupCheckout(packageId = "topup"): Promise<void> {
  await startCheckout("/api/billing/checkout", { packageId });
}

/** Starts a recurring subscription and redirects the browser to Stripe Checkout. */
export async function startSubscriptionCheckout(planId = "monthly"): Promise<void> {
  await startCheckout("/api/billing/subscription/checkout", { planId });
}

export async function cancelSubscription(): Promise<void> {
  try {
    await api.post("/api/billing/subscription/cancel");
  } catch (error) {
    throw new Error(
      extractErrorMessage(error, "Could not cancel the subscription."),
      { cause: error }
    );
  }
}

export async function resumeSubscription(): Promise<void> {
  try {
    await api.post("/api/billing/subscription/resume");
  } catch (error) {
    throw new Error(
      extractErrorMessage(error, "Could not resume the subscription."),
      { cause: error }
    );
  }
}

async function startCheckout(
  path: string,
  body: Record<string, string>
): Promise<void> {
  try {
    const { data } = await api.post<{ url: string }>(path, body);
    if (data.url) {
      window.location.href = data.url;
    }
  } catch (error) {
    throw new Error(extractErrorMessage(error, "Could not start checkout."), {
      cause: error
    });
  }
}
