import type { Subscription, SubscriptionStatus } from "@/domain/entities/subscription";

export interface DailyUsageResult {
  dailyCreditsUsed: number;
  wasReset: boolean;
}

export interface SubscriptionRepository {
  findActiveByUserId(userId: string): Promise<Subscription | null>;
  findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<Subscription | null>;
  upsert(subscription: Subscription): Promise<Subscription>;
  updateStatus(id: string, status: SubscriptionStatus): Promise<void>;
  incrementDailyCreditsUsed(id: string, credits: number, today: string): Promise<DailyUsageResult>;
}
