import type { Cost } from "@/domain/logic/cost/cost";
import type {
  CostEntry,
  CostOperation,
  CostReporter
} from "@/domain/services/cost-reporter";
import { logger as sink } from "@/shared/logger";

export class ConsoleCostReporter implements CostReporter {
  private runningTotalUsd = 0;

  report(entry: CostEntry): void {
    if (!entry.summary) {
      this.runningTotalUsd += entry.cost.usd;
    }
    const { operation, cost } = entry;

    const header =
      `💲 [cost] ${LABELS[operation]} · ${cost.model} · ${usd(cost.usd)}` +
      (cost.estimated ? " (estimated)" : "") +
      (entry.context ? ` · ${entry.context}` : "");
    const lines = [header, ...this.breakdown(cost), ...this.metaLines(entry)];
    lines.push(`     ── session total so far: ${usd(this.runningTotalUsd)}`);

    sink.info(lines.join("\n"));
  }

  private breakdown(cost: Cost): string[] {
    return cost.lines
      .filter((line) => line.units > 0)
      .map(
        (line) =>
          `     ${line.label.padEnd(20)} ${tokens(line.units)} tok ` +
          `× $${line.ratePerM}/M = ${usd(line.usd)}`
      );
  }

  private metaLines(entry: CostEntry): string[] {
    if (!entry.meta) return [];
    const parts = Object.entries(entry.meta).map(([key, value]) => `${key}=${value}`);
    return parts.length ? [`     · ${parts.join(" · ")}`] : [];
  }
}

const LABELS: Record<CostOperation, string> = {
  "tutor-turn": "tutor turn",
  "tutor-question": "TUTOR QUESTION (total)",
  embedding: "embedding",
  speech: "speech (TTS)",
  transcription: "transcription (STT)"
};

function usd(amount: number): string {
  return `$${amount.toFixed(6)}`;
}

function tokens(count: number): string {
  return count.toLocaleString("en-US");
}
