import type { AiUsage } from "@/domain/services/ai-usage";
import type { ModelRate } from "@/config/pricing.config";
import { DEFAULT_RATE } from "@/config/pricing.config";
import type { Logger } from "@/domain/services/logger";

export class CostCalculator {
  private readonly warnedModels = new Set<string>();

  constructor(
    private readonly pricing: Readonly<Record<string, ModelRate>>,
    private readonly logger?: Logger
  ) { }

  /** USD cost of one call. */
  usd(usage: AiUsage): number {
    const rate = this.pricing[usage.model] ?? this.fallback(usage.model);
    const cached = Math.min(usage.cachedInputTokens ?? 0, usage.inputTokens);
    const freshInput = usage.inputTokens - cached;
    const cachedRate = rate.cachedInputPer1M ?? rate.inputPer1M;
    return (
      (freshInput / 1_000_000) * rate.inputPer1M +
      (cached / 1_000_000) * cachedRate +
      (usage.outputTokens / 1_000_000) * rate.outputPer1M
    );
  }

  private fallback(model: string): ModelRate {
    if (this.logger && !this.warnedModels.has(model)) {
      this.warnedModels.add(model);
      this.logger.warn(
        `no price configured for model "${model}" — its cost is counted as $0`
      );
    }
    return DEFAULT_RATE;
  }
}
