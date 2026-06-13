

/** Per-1M-token rates for a chat/Responses model. */
export interface LlmRate {
  readonly inputPerM: number;
  readonly cachedInputPerM: number;
  readonly outputPerM: number;
}

/** Per-1M-token rate for an embedding model. */
export interface EmbeddingRate {
  readonly inputPerM: number;
}

export interface SpeechRate {
  readonly inputTextPerM: number;
  readonly outputAudioPerM: number;
  readonly estTextTokensPerChar: number;
  readonly estAudioTokensPerChar: number;
}

export interface TranscriptionRate {
  readonly audioInputPerM: number;
  readonly textOutputPerM: number;
  readonly estAudioTokensPerKiB: number;
}

export interface PricingTable {
  readonly llm: Readonly<Record<string, LlmRate>>;
  readonly embedding: Readonly<Record<string, EmbeddingRate>>;
  readonly speech: Readonly<Record<string, SpeechRate>>;
  readonly transcription: Readonly<Record<string, TranscriptionRate>>;
}

export const PRICING: PricingTable = Object.freeze({
  llm: {
    "gpt-5.5": { inputPerM: 1.75, cachedInputPerM: 0.175, outputPerM: 14.0 },
    "gpt-5.4": { inputPerM: 1.25, cachedInputPerM: 0.125, outputPerM: 10.0 },
    "gpt-5.4-mini": { inputPerM: 0.25, cachedInputPerM: 0.025, outputPerM: 2.0 },
    "gpt-5-nano": { inputPerM: 0.05, cachedInputPerM: 0.005, outputPerM: 0.4 },
    "gpt-5-mini": { inputPerM: 0.25, cachedInputPerM: 0.025, outputPerM: 2.0 },
    "gpt-4o-mini": { inputPerM: 0.15, cachedInputPerM: 0.075, outputPerM: 0.6 },
    "gpt-4o": { inputPerM: 2.5, cachedInputPerM: 1.25, outputPerM: 10.0 }
  },
  embedding: {
    "text-embedding-3-small": { inputPerM: 0.02 },
    "text-embedding-3-large": { inputPerM: 0.13 }
  },
  speech: {
    "gpt-4o-mini-tts": {
      inputTextPerM: 0.6,
      outputAudioPerM: 12.0,
      estTextTokensPerChar: 0.25,
      estAudioTokensPerChar: 2.0
    }
  },
  transcription: {
    "gpt-4o-mini-transcribe": {
      audioInputPerM: 3.0,
      textOutputPerM: 10.0,
      estAudioTokensPerKiB: 8.0
    },
    "gpt-4o-transcribe": {
      audioInputPerM: 6.0,
      textOutputPerM: 10.0,
      estAudioTokensPerKiB: 8.0
    }
  }
});
