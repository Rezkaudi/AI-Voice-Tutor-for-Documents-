import type { Cost } from "@/domain/logic/cost/cost";

export type CostOperation =
  | "tutor-turn"
  | "tutor-question"
  | "embedding"
  | "speech"
  | "transcription";

export interface CostEntry {
  readonly operation: CostOperation;
  readonly cost: Cost;
  readonly context?: string;
  readonly meta?: Readonly<Record<string, string | number>>;
  readonly summary?: boolean;
}

export interface CostReporter {
  report(entry: CostEntry): void;
}
