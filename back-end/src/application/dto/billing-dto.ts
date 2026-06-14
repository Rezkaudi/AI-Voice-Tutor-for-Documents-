import type { PaymentTransactionStatus } from "@/domain/entities/payment-transaction";
import type { SubscriptionStatus } from "@/domain/entities/subscription";

export interface CheckoutUrlDto {
  url: string;
}

export interface BalanceDto {
  creditBalance: number;
  subscriptionCredits: number;
  topupCredits: number;
  hasPurchased: boolean;
}

export interface PaymentStatusDto {
  status: PaymentTransactionStatus | "unknown";
  creditBalance: number;
}

export interface SubscriptionStatusDto {
  active: boolean;
  status: SubscriptionStatus | null;
  planId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  dailyCreditsLimit: number | null;
  dailyCreditsUsed: number | null;
  dailyCreditsRemaining: number | null;
}

export interface PlanOptionDto {
  id: string;
  name: string;
  credits: number;
  amount: number;
  currency: string;
  recurring: boolean;
}
