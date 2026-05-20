import { transcribeRecording } from "./transcribeApi";
import type { SpeechLanguage, VoiceRecorderState } from "@/lib/types";

const AUDIO_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4"
];

/**
 * Records a single microphone clip, uploads it for transcription, and reports
 * the resulting text. State changes are pushed through the
 * `onState` callback, which the voice store binds to React state.
 *
 * `permission` values: "unknown" | "prompt" | "granted" | "denied".
 */
export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: BlobPart[] = [];
  private transcribeAbort: AbortController | null = null;
  private cancelled = false;
  private permissionStatus: PermissionStatus | null = null;

  onTranscript: (text: string) => void = () => {};
  onError: (message: string) => void = () => {};
  getLanguage: () => SpeechLanguage | undefined = () => undefined;
  onState: (patch: Partial<VoiceRecorderState>) => void = () => {};

  /** True when this browser supports microphone recording. */
  isSupportedNow(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof window.MediaRecorder !== "undefined" &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function"
    );
  }

  /**
   * Tracks the live permission state. The `onchange` handler is what lets the
   * UI recover the moment the user re-enables a previously blocked mic in their
   * browser site settings — no page reload required.
   */
  watchPermission(): void {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) {
      return;
    }
    navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((result) => {
        this.permissionStatus = result;
        this.onState({ permission: result.state });
        result.onchange = () => this.onState({ permission: result.state });
      })
      .catch(() => {
        // Firefox/Safari may not expose "microphone" — leave it "unknown".
      });
  }

  private cleanupStream(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }

  /** Asks the browser for mic access. Resolves to the resulting grant. */
  async requestPermission(): Promise<boolean> {
    if (!this.isSupportedNow()) {
      this.onError("Microphone recording is not supported in this browser.");
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Only probing the grant here — release the device immediately.
      stream.getTracks().forEach((track) => track.stop());
      this.onState({ permission: "granted" });
      return true;
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
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
      this.onError("Microphone recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.stream = stream;
      this.onState({ permission: "granted" });
      const mimeType = pickAudioMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      this.chunks = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };

      recorder.onerror = () => {
        this.onError("Recording failed. Check your microphone and try again.");
        this.cleanupStream();
        this.onState({ isListening: false });
      };

      recorder.onstop = async () => {
        const chunks = this.chunks;
        this.chunks = [];
        this.cleanupStream();
        if (chunks.length === 0 || this.cancelled) {
          this.onState({ isListening: false });
          return;
        }

        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        this.onState({ isListening: false, isTranscribing: true });
        const controller = new AbortController();
        this.transcribeAbort = controller;
        try {
          const text = await transcribeRecording(blob, this.getLanguage(), controller.signal);
          if (text) {
            this.onTranscript(text);
          }
        } catch (error) {
          if (!controller.signal.aborted) {
            this.onError(error instanceof Error ? error.message : "Transcription failed.");
          }
        } finally {
          if (this.transcribeAbort === controller) {
            this.transcribeAbort = null;
          }
          this.onState({ isTranscribing: false });
        }
      };

      this.mediaRecorder = recorder;
      this.cancelled = false;
      recorder.start();
      this.onState({ isListening: true });
    } catch (error) {
      this.cleanupStream();
      // Browsers without the Permissions API only reveal a block here.
      const name = error instanceof Error ? error.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
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
}

function pickAudioMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") {
    return null;
  }
  return (
    AUDIO_MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported?.(type)) ?? null
  );
}

function describeRecorderError(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No microphone was found. Connect one and try again.";
  }
  return error instanceof Error ? error.message : "Could not start the microphone.";
}
