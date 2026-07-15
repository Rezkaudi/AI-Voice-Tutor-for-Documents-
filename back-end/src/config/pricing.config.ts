import type { ModelRate } from "@/domain/logic/cost/model-rate";

export const MODEL_PRICING: Readonly<Record<string, ModelRate>> = Object.freeze({
  // ─── Tutor chat (Responses API) ──────────────────────────────────────────
  "gpt-5.5": { inputPer1M: 5.0, outputPer1M: 30.0 },
  "gpt-5.5-pro": { inputPer1M: 30.0, outputPer1M: 180.0 },
  "gpt-5.4": { inputPer1M: 2.5, outputPer1M: 15.0, cachedInputPer1M: 0.25 },
  "gpt-5.4-mini": { inputPer1M: 0.25, outputPer1M: 2.0, cachedInputPer1M: 0.025 },
  "gpt-5": { inputPer1M: 1.25, outputPer1M: 10.0, cachedInputPer1M: 0.125 },
  "gpt-5-mini": { inputPer1M: 0.25, outputPer1M: 2.0, cachedInputPer1M: 0.025 },
  "gpt-5-nano": { inputPer1M: 0.05, outputPer1M: 0.4, cachedInputPer1M: 0.005 },
  "gpt-4.1": { inputPer1M: 2.0, outputPer1M: 8.0, cachedInputPer1M: 0.5 },
  "gpt-4.1-mini": { inputPer1M: 0.4, outputPer1M: 1.6, cachedInputPer1M: 0.1 },
  "gpt-4.1-nano": { inputPer1M: 0.1, outputPer1M: 0.4, cachedInputPer1M: 0.025 },
  "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10.0, cachedInputPer1M: 1.25 },
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6, cachedInputPer1M: 0.075 },

  // ─── Voice — text-to-speech ──────────────────────────────────────────────
  "gpt-4o-mini-tts": { inputPer1M: 0.6, outputPer1M: 12.0 },
  "tts-1": { inputPer1M: 60.0, outputPer1M: 0 }, // $15 / 1M chars × 4
  "tts-1-hd": { inputPer1M: 120.0, outputPer1M: 0 }, // $30 / 1M chars × 4

  // ─── Voice — speech-to-text (transcription) ──────────────────────────────
  "gpt-4o-mini-transcribe": { inputPer1M: 1.25, outputPer1M: 5.0 },
  "gpt-4o-transcribe": { inputPer1M: 2.5, outputPer1M: 10.0 }
});
