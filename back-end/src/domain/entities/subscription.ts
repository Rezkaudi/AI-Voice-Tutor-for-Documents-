export type SubscriptionStatus = "active" | "canceled" | "past_due" | "expired";

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  dailyCreditsLimit: number;
  dailyCreditsUsed: number;
  lastUsageResetDate: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}
