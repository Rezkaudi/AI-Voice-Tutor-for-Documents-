import { fetchSpeechClip } from "../speechApi";
import { segmentText } from "@/lib/textSegmentation";
import type { SpeechCaption, SpeechSession } from "@/types";
import { CaptionController } from "./CaptionController";
import { playAudioClip, revokeBlobUrl } from "./audioPlayback";
import { unlockAudioPlayback } from "./audioUnlock";
import { playWithSpeechSynthesis } from "./speechSynthesisPlayback";
import { ESTIMATED_WORD_SECONDS, MAX_TTS_CHARS } from "./constants";

export class SpeechEngine {
  private audio: HTMLAudioElement | null = null;
  private sessionId = 0;
  private speakAbort: AbortController | null = null;
  private paused = false;

  private readonly caption = new CaptionController((value) => this.onCaption(value));

  onSpeakingChange: (speaking: boolean) => void = () => { };
  onCaption: (caption: SpeechCaption | null) => void = () => { };
  unlock(): void {
    unlockAudioPlayback(this.ensureAudio());
  }

  private ensureAudio(): HTMLAudioElement {
    this.audio ??= new Audio();
    return this.audio;
  }

  setPaused(value: boolean): void {
    this.paused = value;
    const audio = this.audio;
    const synth =
      typeof window !== "undefined" && "speechSynthesis" in window
        ? window.speechSynthesis
        : null;

    if (value) {
      if (audio && !audio.paused) audio.pause();
      synth?.pause();
      this.caption.pause();
      this.onSpeakingChange(false);
    } else {
      if (audio && audio.src && !audio.ended) audio.play().catch(() => {});
      synth?.resume();
      this.caption.resume();
    }
  }

  get isPaused(): boolean {
    return this.paused;
  }

  clearCaption(): void {
    this.caption.reset();
  }

  stopSpeaking(): void {
    this.sessionId += 1;
    this.speakAbort?.abort();
    this.speakAbort = null;
    const audio = this.audio;
    if (audio) {
      audio.pause();
      revokeBlobUrl(audio.src);
      audio.removeAttribute("src");
      audio.load();
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    this.caption.reset();
    this.onSpeakingChange(false);
  }

  createSession(): SpeechSession {
    const sessionId = ++this.sessionId;
    const isStale = () => sessionId !== this.sessionId;
    const controller = new AbortController();
    this.speakAbort = controller;
    let chain: Promise<void> = Promise.resolve();
    const onSpeakingChange = (value: boolean) => this.onSpeakingChange(value);

    const push = (sentence: string, onPlaybackStart?: (durationMs: number) => void) => {

      const segmented = segmentText(sentence);
      if (segmented.words.length === 0) return;
      const speechText = segmented.clean.slice(0, MAX_TTS_CHARS);

      const clip = isStale()
        ? Promise.resolve(null)
        : fetchSpeechClip(speechText, controller.signal);

      chain = chain.then(async () => {
        if (isStale()) return;
        const blob = await clip;
        if (isStale()) return;

        const onStart = onPlaybackStart
          ? (durationMs: number) => {
            if (!isStale()) onPlaybackStart(durationMs);
          }
          : undefined;

        if (blob) {
          await playAudioClip({
            audio: this.ensureAudio(),
            blob,
            segmented,
            isStale,
            isPaused: () => this.paused,
            caption: this.caption,
            onSpeakingChange,
            onStart
          });
        } else {

          await playWithSpeechSynthesis({
            segmented,
            isStale,
            caption: this.caption,
            onSpeakingChange,
            onStart
          });
        }
      });
    };

    return {
      push,
      finished: () =>
        chain.then(() => {

          if (!isStale()) this.caption.reset();
        })
    };
  }

  showUserCaption(text: string): void {
    const segmented = segmentText(text);
    if (segmented.words.length === 0) return;
    this.caption.reveal(
      segmented,
      segmented.words.length * ESTIMATED_WORD_SECONDS * 1000,
      "user"
    );
  }
}
