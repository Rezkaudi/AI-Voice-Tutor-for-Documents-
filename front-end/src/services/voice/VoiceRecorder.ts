import { MicVAD, utils } from "@ricky0123/vad-web";
import { transcribeRecording } from "../transcribeApi";
import {
  ORT_WASM_BASE,
  VAD_ASSET_BASE,
  VAD_MIN_RMS,
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

function rms(frame: Float32Array): number {
  if (frame.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
  return Math.sqrt(sum / frame.length);
}

export class VoiceRecorder {
  private vad: MicVAD | null = null;
  private stream: MediaStream | null = null;
  private starting: Promise<void> | null = null;
  private transcribeAbort: AbortController | null = null;
  private destroyed = false;
  private suspended = false;
  private userMuted = false;

  onTranscript: (text: string) => void = () => { };
  onError: (message: string) => void = () => { };
  onSpeechStart: () => void = () => { };
  getLanguage: () => SpeechLanguage | undefined = () => undefined;
  onState: (patch: Partial<VoiceRecorderState>) => void = () => { };
  isSupportedNow(): boolean {
    return (
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof AudioContext !== "undefined"
    );
  }

  watchPermission(): void {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return;

    navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((result) => {
        this.onState({ permission: result.state });
        result.onchange = () => this.onState({ permission: result.state });
      })
      .catch(() => { });
  }

  async requestPermission(): Promise<boolean> {
    if (!this.isSupportedNow()) {
      this.onError(NOT_SUPPORTED_MESSAGE);
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: VOICE_AUDIO_CONSTRAINTS
      });
      stream.getTracks().forEach((track) => track.stop());
      this.onState({ permission: "granted" });
      return true;
    } catch (error) {
      if (isPermissionDenied(error)) {
        this.onState({ permission: "denied" });
        return false;
      }
      this.onError(error instanceof Error ? error.message : "Microphone error.");
      return false;
    }
  }

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

  async start(): Promise<void> {
    this.suspended = false;
    await this.startSession();
  }

  async prewarm(): Promise<void> {
    if (this.vad || this.starting) return;
    this.suspended = true;
    await this.startSession();
  }

  setSuspended(value: boolean): void {
    if (this.suspended === value) return;
    this.suspended = value;
    this.applyGate();
  }

  setUserMuted(value: boolean): void {
    if (this.userMuted === value) return;
    this.userMuted = value;
    this.applyGate();
  }

  stop(): void {
    this.onState({ isListening: false, isUserSpeaking: false });
  }

  cancel(): void {
    this.destroyed = true;
    this.suspended = false;
    this.userMuted = false;
    this.transcribeAbort?.abort();
    this.transcribeAbort = null;
    const vad = this.vad;
    this.vad = null;
    const stream = this.stream;
    this.stream = null;
    if (vad) void vad.destroy();
    stream?.getTracks().forEach((track) => track.stop());
    this.onState({ isListening: false, isUserSpeaking: false, isTranscribing: false });
  }

  private applyGate(): void {
    const open = !!this.vad && !this.suspended && !this.userMuted && !this.destroyed;
    console.log("[VAD] applyGate", { open, hasVad: !!this.vad, suspended: this.suspended, userMuted: this.userMuted, destroyed: this.destroyed });
    if (open) {
      void this.vad!.start();
      this.onState({ isListening: true, isUserSpeaking: false });
    } else {
      void this.vad?.pause();
      this.onState({ isListening: false, isUserSpeaking: false });
    }
  }

  private async buildVad(): Promise<MicVAD> {
    let peakRms = 0;
    console.log("[VAD] buildVad: loading models...");

    return MicVAD.new({
      getStream: async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: VOICE_AUDIO_CONSTRAINTS });
        this.stream = stream;
        return stream;
      },
      pauseStream: async (stream) => {
        stream.getAudioTracks().forEach((track) => (track.enabled = false));
      },
      resumeStream: async (stream) => {
        stream.getAudioTracks().forEach((track) => (track.enabled = true));
        return stream;
      },
      positiveSpeechThreshold: VAD_POSITIVE_SPEECH_THRESHOLD,
      negativeSpeechThreshold: VAD_NEGATIVE_SPEECH_THRESHOLD,
      minSpeechMs: VAD_MIN_SPEECH_MS,
      redemptionMs: VAD_REDEMPTION_MS,
      preSpeechPadMs: VAD_PRE_SPEECH_PAD_MS,
      baseAssetPath: VAD_ASSET_BASE,
      onnxWASMBasePath: ORT_WASM_BASE,
      onFrameProcessed: (_probabilities, frame) => {
        peakRms = Math.max(rms(frame), peakRms * 0.92);
      },
      onSpeechRealStart: () => {
        console.log("[VAD] onSpeechRealStart", { peakRms, min: VAD_MIN_RMS, gated: peakRms < VAD_MIN_RMS });
        if (peakRms < VAD_MIN_RMS) return;
        this.onState({ isListening: true, isUserSpeaking: true });
        this.onSpeechStart();
      },
      onVADMisfire: () => { console.log("[VAD] onVADMisfire"); },
      onSpeechEnd: (audio) => {
        const endRms = rms(audio);
        const loud = endRms >= VAD_MIN_RMS;
        console.log("[VAD] onSpeechEnd", { endRms, min: VAD_MIN_RMS, loud, samples: audio.length });
        peakRms = 0;
        if (loud) void this.handleSpeechEnd(audio);
        else this.onState({ isListening: false, isUserSpeaking: false });
      }
    });
  }

  private async handleSpeechEnd(audio: Float32Array): Promise<void> {
    this.onState({ isListening: false, isUserSpeaking: false, isTranscribing: true });
    const wav = utils.encodeWAV(audio, 1, 16000, 1, 16);
    const blob = new Blob([wav], { type: "audio/wav" });

    const controller = new AbortController();
    this.transcribeAbort = controller;
    try {
      const text = await transcribeRecording(blob, this.getLanguage(), controller.signal);
      console.log("[VAD] transcript", JSON.stringify(text));
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
