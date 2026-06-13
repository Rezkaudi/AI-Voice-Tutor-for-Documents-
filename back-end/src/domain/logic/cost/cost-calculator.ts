import type {
  EmbeddingRate,
  LlmRate,
  PricingTable,
  SpeechRate,
  TranscriptionRate
} from "@/config/pricing.config";
import { type Cost, type CostLine, type LlmUsage, type TranscriptionUsage, costLine } from "./cost";

const ZERO_LLM: LlmRate = { inputPerM: 0, cachedInputPerM: 0, outputPerM: 0 };
const ZERO_EMBEDDING: EmbeddingRate = { inputPerM: 0 };
const ZERO_SPEECH: SpeechRate = {
  inputTextPerM: 0,
  outputAudioPerM: 0,
  estTextTokensPerChar: 0.25,
  estAudioTokensPerChar: 2.0
};
const ZERO_TRANSCRIPTION: TranscriptionRate = {
  audioInputPerM: 0,
  textOutputPerM: 0,
  estAudioTokensPerKiB: 8.0
};

export class CostCalculator {
  constructor(private readonly pricing: PricingTable) { }

  /** Cost of one LLM (Responses/chat) call from its exact token usage. */
  llm(model: string, usage: LlmUsage): Cost {
    const rate = this.pricing.llm[model];
    const r = rate ?? ZERO_LLM;
    const freshInput = Math.max(0, usage.inputTokens - usage.cachedInputTokens);
    const lines: CostLine[] = [
      costLine("input", freshInput, r.inputPerM),
      costLine("cached input", usage.cachedInputTokens, r.cachedInputPerM),
      costLine("output", usage.outputTokens, r.outputPerM)
    ];
    return this.assemble(model, lines, !rate);
  }

  embedding(model: string, tokens: number): Cost {
    const rate = this.pricing.embedding[model];
    const r = rate ?? ZERO_EMBEDDING;
    return this.assemble(model, [costLine("input", tokens, r.inputPerM)], !rate);
  }

  speech(model: string, inputText: string): Cost {
    const rate: SpeechRate = this.pricing.speech[model] ?? ZERO_SPEECH;
    const chars = inputText.length;
    const textTokens = Math.ceil(chars * rate.estTextTokensPerChar);
    const audioTokens = Math.ceil(chars * rate.estAudioTokensPerChar);
    const lines: CostLine[] = [
      costLine("input text (est)", textTokens, rate.inputTextPerM),
      costLine("output audio (est)", audioTokens, rate.outputAudioPerM)
    ];
    return this.assemble(model, lines, true);
  }

  transcription(
    model: string,
    usage: TranscriptionUsage,
    estimated: boolean
  ): Cost {
    const rate: TranscriptionRate =
      this.pricing.transcription[model] ?? ZERO_TRANSCRIPTION;
    const lines: CostLine[] = [
      costLine("audio input", usage.audioInputTokens, rate.audioInputPerM),
      costLine("text input", usage.textInputTokens, rate.audioInputPerM),
      costLine("text output", usage.outputTokens, rate.textOutputPerM)
    ];
    return this.assemble(model, lines, estimated || !this.pricing.transcription[model]);
  }

  estimateAudioTokens(model: string, audioBytes: number): number {
    const rate = this.pricing.transcription[model] ?? ZERO_TRANSCRIPTION;
    return Math.ceil((audioBytes / 1024) * rate.estAudioTokensPerKiB);
  }

  total(model: string, costs: ReadonlyArray<Cost>): Cost {
    const lines = costs.flatMap((cost) => cost.lines);
    const estimated = costs.some((cost) => cost.estimated);
    return this.assemble(model, lines, estimated);
  }

  private assemble(model: string, lines: CostLine[], estimated: boolean): Cost {
    const usd = lines.reduce((sum, line) => sum + line.usd, 0);
    return { model, usd, lines, estimated };
  }
}
