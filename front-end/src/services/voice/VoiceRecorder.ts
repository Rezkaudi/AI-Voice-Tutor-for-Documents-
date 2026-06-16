import { transcribeRecording } from "../transcribeApi";
import { SILENCE_TIMEOUT_MS } from "@/lib/constants";
import type { SpeechLanguage, VoiceRecorderState } from "@/lib/types";
import { pickAudioMimeType } from "./audioMime";
import {
  describeRecorderError,
  isMediaRecorderSupported,
  isPermissionDenied
} from "./recorderErrors";

const NOT_SUPPORTED_MESSAGE = "Microphone recording is not supported in this browser.";

// VAD = Voice Activity Detection: deciding whether the mic input is actual
// speech rather than silence/background noise, so we can auto-cancel silent clips.

/** RMS (Root Mean Square — the audio signal's loudness/energy) mic level (0–1) above which a window counts as speech rather than noise. */
const VAD_SPEECH_THRESHOLD = 0.015;
/** How often the analyser samples the live mic level. */
const VAD_CHECK_INTERVAL_MS = 250;

/**
 * Records a single microphone clip, uploads it for transcription, and reports
 * the resulting text. State changes are pushed through the `onState` callback,
 * which the voice store binds to React state.
 *
 * `permission` values: "unknown" | "prompt" | "granted" | "denied".
 */
export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: BlobPart[] = [];
  private transcribeAbort: AbortController | null = null;
  private cancelled = false;

  // Voice-activity detection state for the current clip.
  private audioContext: AudioContext | null = null;
  private vadTimer: ReturnType<typeof setInterval> | null = null;
  private lastVoiceAt = 0;
  private autoStopping = false;

  onTranscript: (text: string) => void = () => { };
  onError: (message: string) => void = () => { };
  getLanguage: () => SpeechLanguage | undefined = () => undefined;
  onState: (patch: Partial<VoiceRecorderState>) => void = () => { };

  /** True when this browser supports microphone recording. */
  isSupportedNow(): boolean {
    return isMediaRecorderSupported();
  }

  /**
   * Tracks the live permission state. The `onchange` handler is what lets the
   * UI recover the moment the user re-enables a previously blocked mic in
   * their browser site settings — no page reload required.
   */
  watchPermission(): void {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return;

    navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((result) => {
        this.onState({ permission: result.state });
        result.onchange = () => this.onState({ permission: result.state });
      })
      .catch(() => {
        // Firefox/Safari may not expose "microphone" — leave it "unknown".
      });
  }

  /** Asks the browser for mic access. Resolves to the resulting grant. */
  async requestPermission(): Promise<boolean> {
    if (!this.isSupportedNow()) {
      this.onError(NOT_SUPPORTED_MESSAGE);
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Only probing the grant here — release the device immediately.
      stream.getTracks().forEach((track) => track.stop());
      this.onState({ permission: "granted" });
      return true;
    } catch (error) {
      if (isPermissionDenied(error)) {
        // The blocked-mic popup explains this — skip the inline error bubble.
        this.onState({ permission: "denied" });
        return false;
      }
      this.onError(describeRecorderError(error));
      return false;
    }
  }

  /** Starts recording a clip. */
  async start(): Promise<void> {
    if (!this.isSupportedNow()) {
      this.onError(NOT_SUPPORTED_MESSAGE);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.stream = stream;
      this.onState({ permission: "granted" });
      const recorder = this.buildRecorder(stream);
      this.mediaRecorder = recorder;
      this.cancelled = false;
      recorder.start();
      this.startVad(stream);
      this.onState({ isListening: true });
    } catch (error) {
      this.cleanupStream();
      // Browsers without the Permissions API only reveal a block here.
      if (isPermissionDenied(error)) {
        this.onState({ permission: "denied" });
        return;
      }
      this.onError(describeRecorderError(error));
    }
  }

  /** Stops recording; the clip is then transcribed and reported. */
  stop(): void {
    const recorder = this.mediaRecorder;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      this.cleanupStream();
      this.onState({ isListening: false });
    }
  }

  /** Stops recording and aborts any in-flight transcription without sending it. */
  cancel(): void {
    this.cancelled = true;
    this.transcribeAbort?.abort();
    this.transcribeAbort = null;
    const recorder = this.mediaRecorder;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      this.cleanupStream();
    }
    this.onState({ isListening: false, isTranscribing: false });
  }

  private buildRecorder(stream: MediaStream): MediaRecorder {
    const mimeType = pickAudioMimeType();
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);
    this.chunks = [];

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) this.chunks.push(event.data);
    };

    recorder.onerror = () => {
      this.onError("Recording failed. Check your microphone and try again.");
      this.cleanupStream();
      this.onState({ isListening: false });
    };

    recorder.onstop = () => {
      const chunks = this.chunks;
      this.chunks = [];
      this.cleanupStream();
      if (chunks.length === 0 || this.cancelled) {
        this.onState({ isListening: false });
        return;
      }
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      void this.transcribeBlob(blob);
    };

    return recorder;
  }

  private async transcribeBlob(blob: Blob): Promise<void> {
    this.onState({ isListening: false, isTranscribing: true });
    const controller = new AbortController();
    this.transcribeAbort = controller;
    try {
      const text = await transcribeRecording(blob, this.getLanguage(), controller.signal);
      if (text) this.onTranscript(text);
    } catch (error) {
      if (!controller.signal.aborted) {
        this.onError(error instanceof Error ? error.message : "Transcription failed.");
      }
    } finally {
      if (this.transcribeAbort === controller) this.transcribeAbort = null;
      this.onState({ isTranscribing: false });
    }
  }

  private startVad(stream: MediaStream): void {
    this.stopVad();
    this.autoStopping = false;
    this.lastVoiceAt = Date.now();

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;

      const context = new AudioCtx();
      this.audioContext = context;
      if (context.state === "suspended") void context.resume().catch(() => { });
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const samples = new Uint8Array(analyser.fftSize).fill(128);

      this.vadTimer = setInterval(() => {
        analyser.getByteTimeDomainData(samples);
        let sumSquares = 0;
        for (let i = 0; i < samples.length; i += 1) {
          const deviation = (samples[i] - 128) / 128;
          sumSquares += deviation * deviation;
        }
        const level = Math.sqrt(sumSquares / samples.length);

        const now = Date.now();
        if (level >= VAD_SPEECH_THRESHOLD) {
          this.lastVoiceAt = now;
          return;
        }
        if (now - this.lastVoiceAt >= SILENCE_TIMEOUT_MS) {
          this.autoStop();
        }
      }, VAD_CHECK_INTERVAL_MS);
    } catch {
    }
  }

  private autoStop(): void {
    if (this.autoStopping) return;
    this.autoStopping = true;
    this.cancel();
  }

  private stopVad(): void {
    if (this.vadTimer !== null) {
      clearInterval(this.vadTimer);
      this.vadTimer = null;
    }
    if (this.audioContext) {
      void this.audioContext.close().catch(() => { });
      this.audioContext = null;
    }
  }

  private cleanupStream(): void {
    this.stopVad();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
}
