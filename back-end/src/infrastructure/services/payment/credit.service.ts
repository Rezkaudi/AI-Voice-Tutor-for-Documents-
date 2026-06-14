import type { EnvConfig } from "@/config/env.config";

import type { ICreditService, PreflightResult, UsageDeduction } from "@/domain/services/credit-service";
import type { UserRepository } from "@/domain/repositories/user-repository";
import type { SubscriptionRepository } from "@/domain/repositories/subscription-repository";
import type { Logger } from "@/domain/services/logger";

import { todayKey } from "@/shared/date";

export class CreditService implements ICreditService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly env: EnvConfig,
    private readonly logger: Logger
  ) { }

  calculateCreditCost(usd: number): number {
    if (!Number.isFinite(usd) || usd <= 0) return 0;
    const burnRate = this.env.CREDITS_PER_DOLLAR / (1 - this.env.PROFIT_MARGIN);
    return Math.round(usd * burnRate * 1e6) / 1e6;
  }

  async hasEnoughCredits(userId: string): Promise<PreflightResult> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      return { allowed: false, reason: "no_plan", creditBalance: 0 };
    }

    const total = user.subscriptionCredits + user.topupCredits;
    const subscription =
      await this.subscriptionRepository.findActiveByUserId(userId);

    if (user.topupCredits >= this.env.MIN_CREDITS) {
      return { allowed: true, creditBalance: total };
    }

    if (subscription && user.subscriptionCredits >= this.env.MIN_CREDITS) {
      const usedToday =
        subscription.lastUsageResetDate === todayKey()
          ? subscription.dailyCreditsUsed
          : 0;
      if (usedToday >= subscription.dailyCreditsLimit) {
        return { allowed: false, reason: "daily_limit", creditBalance: total };
      }
      return { allowed: true, creditBalance: total };
    }

    const reason =
      subscription || user.hasPurchased ? "insufficient_credits" : "no_plan";
    return { allowed: false, reason, creditBalance: total };
  }

  async deductForUsage(input: UsageDeduction): Promise<void> {
    const credits = this.calculateCreditCost(input.usd);
    if (credits <= 0) return;
    try {
      const result = await this.userRepository.spendCredits(
        input.userId,
        credits
      );
      const subscription =
        await this.subscriptionRepository.findActiveByUserId(input.userId);
      if (subscription && result.fromSubscription > 0) {
        await this.subscriptionRepository.incrementDailyCreditsUsed(
          subscription.id,
          result.fromSubscription,
          todayKey()
        );
      }
    } catch (error) {
      this.logger.error(
        `credit deduction failed for user ${input.userId}`,
        error
      );
    }
  }
}
