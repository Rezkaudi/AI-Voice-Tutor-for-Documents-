import type { SubscriptionStatusDto } from "@/application/dto/billing-dto";

import type { SubscriptionRepository } from "@/domain/repositories/subscription-repository";
import { todayKey } from "@/shared/date";

export class GetSubscriptionStatusUseCase {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository
  ) { }

  async execute(userId: string): Promise<SubscriptionStatusDto> {
    const sub = await this.subscriptionRepository.findActiveByUserId(userId);
    if (!sub) {
      return {
        active: false,
        status: null,
        planId: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        dailyCreditsLimit: null,
        dailyCreditsUsed: null,
        dailyCreditsRemaining: null
      };
    }

    const usedToday = sub.lastUsageResetDate === todayKey() ? sub.dailyCreditsUsed : 0;

    return {
      active: true,
      status: sub.status,
      planId: sub.planId,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      dailyCreditsLimit: sub.dailyCreditsLimit,
      dailyCreditsUsed: usedToday,
      dailyCreditsRemaining: Math.max(0, sub.dailyCreditsLimit - usedToday)
    };
  }
}
