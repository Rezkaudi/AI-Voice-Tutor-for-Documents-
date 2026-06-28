export interface ModelRate {
  readonly inputPer1M: number;
  readonly outputPer1M: number;

  readonly cachedInputPer1M?: number;
}

export const DEFAULT_RATE: ModelRate = Object.freeze({ inputPer1M: 0, outputPer1M: 0 });
