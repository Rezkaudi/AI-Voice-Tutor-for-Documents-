import { fetchSpeechClip } from "../speechApi";
import { segmentText } from "@/lib/textSegmentation";
import type { SpeechCaption, SpeechSession } from "@/types";
import { CaptionController } from "./CaptionController";
import { playAudioClip, revokeBlobUrl } from "./audioPlayback";
import { unlockAudioPlayback } from "./audioUnlock";
import { playWithSpeechSynthesis } from "./speechSynthesisPlayback";
import { ESTIMATED_WORD_SECONDS, MAX_TTS_CHARS } from "./constants";

/**
 * Engine that synthesizes sentences as they stream in and plays the resulting
 * clips strictly in order, even if a later fetch resolves first. Reports state
 * through the `onSpeakingChange` / `onCaption` callbacks the speech store
 * binds to React state.
 */
export class SpeechEngine {
  private audio: HTMLAudioElement | null = null;
  private sessionId = 0;
  private speakAbort: AbortController | null = null;
  // The arrow forwards to the latest `onCaption`, so the store can reassign
  // it at any time and the controller keeps emitting through the new handler.
  private readonly caption = new CaptionController((value) => this.onCaption(value));

  onSpeakingChange: (speaking: boolean) => void = () => { };
  onCaption: (caption: SpeechCaption | null) => void = () => { };
  unlock(): void {
    unlockAudioPlayback((this.audio ??= new Audio()));
  }

  clearCaption(): void {
    this.caption.reset();
  }

  /** Cancels every in-flight TTS fetch and playback, and clears the caption. */
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

  /** Opens a session that voices pushed sentences strictly in order. */
  createSession(): SpeechSession {
    const sessionId = ++this.sessionId;
    const isStale = () => sessionId !== this.sessionId;
    const controller = new AbortController();
    this.speakAbort = controller;
    let chain: Promise<void> = Promise.resolve();
    const onSpeakingChange = (value: boolean) => this.onSpeakingChange(value);

    const push = (sentence: string, onPlaybackStart?: (durationMs: number) => void) => {
      // Segment once: markdown markers become per-word style flags for the
      // caption, and `clean` is what TTS speaks — never raw asterisks.
      const segmented = segmentText(sentence);
      if (segmented.words.length === 0) return;
      const speechText = segmented.clean.slice(0, MAX_TTS_CHARS);

      // Start synthesis immediately so it overlaps with playback of earlier clips.
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
            audio: (this.audio ??= new Audio()),
            blob,
            segmented,
            isStale,
            caption: this.caption,
            onSpeakingChange,
            onStart
          });
        } else {
          // Fall back to browser speech if server TTS is unavailable (no API key).
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
          // Whole answer voiced: drop the caption once the queue drains.
          if (!isStale()) this.caption.reset();
        })
    };
  }

  /**
   * Plays the learner's just-transcribed sentence back as a caption, in the
   * same rolling style as the teacher's. There is no audio to sync to, so the
   * reveal is paced by an estimate.
   */
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
