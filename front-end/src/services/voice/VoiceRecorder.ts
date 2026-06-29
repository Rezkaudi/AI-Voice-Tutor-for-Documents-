import { MicVAD, utils } from "@ricky0123/vad-web";
import { transcribeRecording } from "../transcribeApi";
import {
  ORT_WASM_BASE,
  VAD_ASSET_BASE,
  VAD_MIN_SPEECH_MS,
  VAD_NEGATIVE_SPEECH_THRESHOLD,
  VAD_POSITIVE_SPEECH_THRESHOLD,
  VAD_PRE_SPEECH_PAD_MS,
  VAD_REDEMPTION_MS,
  VOICE_AUDIO_CONSTRAINTS
} from "@/lib/constants";
import type { SpeechLanguage, VoiceRecorderState } from "@/types";
import { isPermissionDenied } from "./recorderErrors";

const NOT_SUPPORTED_MESSAGE = "Microphone recording is not supported in this browser.";

/**
 * Continuous, hands-free microphone capture built on Silero VAD
 * (`@ricky0123/vad-web`) — the same neural voice-activity model LiveKit/ElevenLabs
 * stacks use. There is no push-to-talk and no silence-timer guesswork:
 *
 * - The VAD runs for the whole call. `onSpeechRealStart` fires only after the
 *   model confirms *real speech* (≥ `minSpeechMs`); a cough/clap/keyboard is too
 *   short and surfaces as `onVADMisfire`, which we ignore — so noise never
 *   interrupts the tutor and never gets sent.
 * - `onSpeechRealStart` → {@link onSpeechStart}: the learner began talking. The
 *   store uses this to barge-in (cut off the tutor) when the tutor is speaking.
 * - `onSpeechEnd` → the learner's turn is complete: the captured audio is encoded
 *   to WAV, transcribed, and reported via {@link onTranscript} (auto-send).
 *
 * Public surface mirrors the old recorder so the stores didn't need reworking
 * (`requestPermission`/`watchPermission`/`isSupportedNow`/`start`/`stop`/`cancel`
 * + the callbacks), plus `startSession` to boot the mic for barge-in before the
 * learner's first turn (e.g. during the opening greeting).
 *
 * `permission` values: "unknown" | "prompt" | "granted" | "denied".
 */
export class VoiceRecorder {
  private vad: MicVAD | null = null;
  private starting: Promise<void> | null = null;
  private transcribeAbort: AbortController | null = null;
  private destroyed = false;
  // Two independent gates can close the mic. `suspended` is automatic — held
  // shut for the tutor's whole speaking/thinking turn so its own voice (or room
  // noise) can never interrupt it (half-duplex). `userMuted` is the manual
  // Mute-Mic button. The mic only listens when BOTH are open.
  private suspended = false;
  private userMuted = false;

  onTranscript: (text: string) => void = () => { };
  onError: (message: string) => void = () => { };
  /** Fires when confirmed speech starts — the store turns this into a barge-in. */
  onSpeechStart: () => void = () => { };
  getLanguage: () => SpeechLanguage | undefined = () => undefined;
  onState: (patch: Partial<VoiceRecorderState>) => void = () => { };

  /** True when this browser can capture the mic (getUserMedia + AudioWorklet). */
  isSupportedNow(): boolean {
    return (
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof AudioContext !== "undefined"
    );
  }

  /**
   * Tracks the live permission state. The `onchange` handler is what lets the
   * UI recover the moment the user re-enables a previously blocked mic in their
   * browser site settings — no page reload required.
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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: VOICE_AUDIO_CONSTRAINTS
      });
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
      this.onError(error instanceof Error ? error.message : "Microphone error.");
      return false;
    }
  }

  /**
   * Boots the continuous VAD session (idempotent). Use this to have the mic
   * listening for a barge-in *without* presenting an active "your turn" state —
   * e.g. while the tutor speaks the opening greeting.
   */
  async startSession(): Promise<void> {
    if (!this.isSupportedNow()) {
      this.onError(NOT_SUPPORTED_MESSAGE);
      return;
    }
    if (this.vad) {
      this.applyGate();
      return;
    }
    if (this.starting) return this.starting;

    this.destroyed = false;
    this.starting = this.buildVad()
      .then((vad) => {
        if (this.destroyed) {
          void vad.destroy();
          return;
        }
        this.vad = vad;
        this.onState({ permission: "granted" });
        this.applyGate();
      })
      .catch((error) => {
        if (isPermissionDenied(error)) {
          this.onState({ permission: "denied" });
        } else {
          this.onError(error instanceof Error ? error.message : "Microphone error.");
        }
      })
      .finally(() => {
        this.starting = null;
      });

    return this.starting;
  }

  /** Begins the learner's turn: ensures the VAD is live, then opens the gate. */
  async start(): Promise<void> {
    this.suspended = false;
    await this.startSession();
  }

  /** Suspends/resumes the mic for the tutor's turn (half-duplex). */
  setSuspended(value: boolean): void {
    if (this.suspended === value) return;
    this.suspended = value;
    this.applyGate();
  }

  /** Manual Mute-Mic toggle from the control bar. */
  setUserMuted(value: boolean): void {
    if (this.userMuted === value) return;
    this.userMuted = value;
    this.applyGate();
  }

  /** Ends the current turn's "listening" state without tearing the session down. */
  stop(): void {
    this.onState({ isListening: false });
  }

  /** Fully stops the session: aborts any in-flight transcription and releases the mic. */
  cancel(): void {
    this.destroyed = true;
    this.suspended = false;
    this.userMuted = false;
    this.transcribeAbort?.abort();
    this.transcribeAbort = null;
    const vad = this.vad;
    this.vad = null;
    if (vad) void vad.destroy();
    this.onState({ isListening: false, isTranscribing: false });
  }

  /**
   * The single source of truth for whether the mic is live. The VAD only runs
   * when a session exists and neither gate is closed; otherwise it's paused so
   * no audio (the tutor's own voice included) can reach it.
   */
  private applyGate(): void {
    const open = !!this.vad && !this.suspended && !this.userMuted && !this.destroyed;
    if (open) {
      void this.vad!.start();
      this.onState({ isListening: true });
    } else {
      void this.vad?.pause();
      this.onState({ isListening: false });
    }
  }

  private async buildVad(): Promise<MicVAD> {
    return MicVAD.new({
      // Reuse the noise-suppressed constraints; echo cancellation is what keeps
      // the tutor's own voice from tripping the VAD during playback.
      getStream: () =>
        navigator.mediaDevices.getUserMedia({ audio: VOICE_AUDIO_CONSTRAINTS }),
      positiveSpeechThreshold: VAD_POSITIVE_SPEECH_THRESHOLD,
      negativeSpeechThreshold: VAD_NEGATIVE_SPEECH_THRESHOLD,
      minSpeechMs: VAD_MIN_SPEECH_MS,
      redemptionMs: VAD_REDEMPTION_MS,
      preSpeechPadMs: VAD_PRE_SPEECH_PAD_MS,
      baseAssetPath: VAD_ASSET_BASE,
      onnxWASMBasePath: ORT_WASM_BASE,
      // Confirmed real speech (not a misfire): claim the turn + signal barge-in.
      onSpeechRealStart: () => {
        this.onState({ isListening: true });
        this.onSpeechStart();
      },
      // Too short to be speech (cough/clap/noise) — ignore entirely.
      onVADMisfire: () => { },
      onSpeechEnd: (audio) => {
        void this.handleSpeechEnd(audio);
      }
    });
  }

  private async handleSpeechEnd(audio: Float32Array): Promise<void> {
    this.onState({ isListening: false, isTranscribing: true });
    const wav = utils.encodeWAV(audio, 1, 16000, 1, 16);
    const blob = new Blob([wav], { type: "audio/wav" });

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
}
