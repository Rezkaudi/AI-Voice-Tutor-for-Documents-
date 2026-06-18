import type { AiUsage } from "@/domain/services/ai-usage";
import type { CostCalculator } from "@/domain/logic/cost-calculator";
import type { UserCostRepository } from "@/domain/repositories/user-cost-repository";
import type { Logger } from "@/domain/services/logger";

export interface TrackOptions {
  readonly countAsQuestion?: boolean;
}

export class CostTracker {
  constructor(
    private readonly repository: UserCostRepository,
    private readonly calculator: CostCalculator,
    private readonly logger: Logger
  ) { }

  async track(userId: string, usage: AiUsage, options: TrackOptions = {}): Promise<void> {
    try {
      const cost = this.calculator.usd(usage);
      const questionDelta = options.countAsQuestion ? 1 : 0;
      await this.repository.increment(userId, cost, questionDelta);
      this.logger
        .scope("cost")
        .info(
          `user ${userId} +$${cost.toFixed(6)} · ${usage.model} · ` +
          `in=${usage.inputTokens} out=${usage.outputTokens}` +
          (questionDelta ? " · +1 question" : "")
        );
    } catch (error) {
      this.logger.scope("cost").error("failed to record AI usage", error);
    }
  }
}
