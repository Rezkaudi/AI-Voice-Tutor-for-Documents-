/**
 * Voice I/O boundaries: text-to-speech and speech-to-text. Both are optional
 * capabilities — when no provider is configured, `isAvailable()` returns false
 * and the application surfaces a "not configured" response so the front-end
 * can fall back to the browser's built-in speech APIs.
 */

/** A synthesized audio clip. */
export interface SynthesizedSpeech {
  readonly audio: Buffer;
  readonly contentType: string;
}

/** Text-to-speech boundary. */
export interface SpeechSynthesisService {
  isAvailable(): boolean;
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

/** Speech-to-text boundary. */
export interface TranscriptionService {
  isAvailable(): boolean;
  /** Transcribes a recorded clip into text. */
  transcribe(input: TranscriptionInput, signal?: AbortSignal): Promise<string>;
}
