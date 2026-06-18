/** Voice I/O boundaries: text-to-speech and speech-to-text. */

import type { AiUsage } from "@/domain/services/ai-usage";

/** A synthesized audio clip, with the token usage producing it consumed. */
export interface SynthesizedSpeech {
  readonly audio: Buffer;
  readonly contentType: string;
  readonly usage: AiUsage;
}

/** Text-to-speech boundary. */
export interface SpeechSynthesisService {
  /** Synthesizes a single sentence into an audio clip. */
  synthesize(text: string, signal?: AbortSignal): Promise<SynthesizedSpeech>;
}

/** A recorded audio clip submitted for transcription. */
export interface TranscriptionInput {
  readonly audio: Buffer;
  readonly filename: string;
  readonly contentType: string;
  /** Optional language hint (ISO-639-1) to improve accuracy. */
  readonly language?: string;
}

/** A transcript plus the token usage producing it consumed. */
export interface TranscriptionResult {
  readonly text: string;
  readonly usage: AiUsage;
}

/** Speech-to-text boundary. */
export interface TranscriptionService {
  /** Transcribes a recorded clip into text. */
  transcribe(
    input: TranscriptionInput,
    signal?: AbortSignal
  ): Promise<TranscriptionResult>;
}
