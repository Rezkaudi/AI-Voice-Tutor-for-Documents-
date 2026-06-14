/** Voice I/O boundaries: text-to-speech and speech-to-text. */

/** A synthesized audio clip. */
export interface SynthesizedSpeech {
  readonly audio: Buffer;
  readonly contentType: string;
}

/** Text-to-speech boundary. */
export interface SpeechSynthesisService {
  /** Synthesizes a single sentence into an audio clip and bills the user. */
  synthesize(text: string, userId: string, signal?: AbortSignal): Promise<SynthesizedSpeech>;
}

/** A recorded audio clip submitted for transcription. */
export interface TranscriptionInput {
  readonly audio: Buffer;
  readonly filename: string;
  readonly contentType: string;
  readonly language?: string;
  readonly userId: string;
}

/** Speech-to-text boundary. */
export interface TranscriptionService {
  /** Transcribes a recorded clip into text. */
  transcribe(input: TranscriptionInput, signal?: AbortSignal): Promise<string>;
}
