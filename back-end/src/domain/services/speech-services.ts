import type { AiUsage } from "@/domain/services/ai-usage";

export interface SynthesizedSpeechStream {
  readonly audio: AsyncIterable<Buffer>;
  readonly contentType: string;
  readonly usage: AiUsage;
}

export interface SpeechSynthesisService {
  synthesizeStream(text: string, signal?: AbortSignal): Promise<SynthesizedSpeechStream>;
}

export interface TranscriptionInput {
  readonly audio: Buffer;
  readonly filename: string;
  readonly contentType: string;
  readonly language?: string;
}

export interface TranscriptionResult {
  readonly text: string;
  readonly usage: AiUsage;
}

export interface TranscriptionService {
  transcribe(input: TranscriptionInput, signal?: AbortSignal): Promise<TranscriptionResult>;
}
