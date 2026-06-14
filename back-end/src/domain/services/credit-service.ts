import type { PaywallReason } from "@/domain/errors/app-error";

export interface PreflightResult {
  allowed: boolean;
  reason?: PaywallReason;
  creditBalance: number;
}

/** A real LLM cost to convert into credits and deduct. */
export interface UsageDeduction {
  userId: string;
  usd: number;
}

export interface ICreditService {
  /** creditsSpent = usd × CREDITS_PER_DOLLAR / (1 − PROFIT_MARGIN). */
  calculateCreditCost(usd: number): number;
  hasEnoughCredits(userId: string): Promise<PreflightResult>;
  deductForUsage(input: UsageDeduction): Promise<void>;
}
