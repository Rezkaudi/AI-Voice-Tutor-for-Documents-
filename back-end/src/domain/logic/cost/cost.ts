

export interface LlmUsage {
  readonly inputTokens: number;
  readonly cachedInputTokens: number;
  readonly outputTokens: number;
  readonly reasoningTokens: number;
}

export interface TranscriptionUsage {
  readonly audioInputTokens: number;
  readonly textInputTokens: number;
  readonly outputTokens: number;
}

export interface CostLine {
  readonly label: string;
  readonly units: number;
  readonly ratePerM: number;
  readonly usd: number;
}

export interface Cost {
  readonly model: string;
  readonly usd: number;
  readonly lines: ReadonlyArray<CostLine>;
  readonly estimated: boolean;
}

export function costLine(label: string, units: number, ratePerM: number): CostLine {
  return { label, units, ratePerM, usd: (units / 1_000_000) * ratePerM };
}
