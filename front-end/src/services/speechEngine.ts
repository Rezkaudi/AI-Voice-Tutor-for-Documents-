import { fetchSpeechClip } from "./speechApi";
import { segmentText } from "../lib/textSegmentation";
import type { CaptionSpeaker, SegmentedText, SpeechCaption, SpeechSession } from "@/lib/types";

const MAX_TTS_CHARS = 4000;
const SPEECH_SYNTHESIS_RATE = 0.96;
// Fallback per-word pace (seconds) when an audio clip exposes no duration.
const ESTIMATED_WORD_SECONDS = 0.34;

/**
 * Engine that synthesizes sentences as they stream in and plays the resulting
 * clips strictly in order, even if a later fetch resolves first. Reusable engine:
 * it reports state through the `onSpeakingChange` / `onCaption` callbacks, which
 * the speech store binds to React state.
 */
export class SpeechEngine {
  private audio: HTMLAudioElement | null = null;
  private sessionId = 0;
  private speakAbort: AbortController | null = null;
  private captionTimer: number | null = null;

  onSpeakingChange: (speaking: boolean) => void = () => {};
  onCaption: (caption: SpeechCaption | null) => void = () => {};

  private clearCaptionTimer(): void {
    if (this.captionTimer !== null) {
      window.clearInterval(this.captionTimer);
      this.captionTimer = null;
    }
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
    this.clearCaptionTimer();
    this.onCaption(null);
    this.onSpeakingChange(false);
  }

  /**
   * Opens a session that voices pushed sentences strictly in order.
   * @returns {{ push: (sentence: string) => void, finished: () => Promise<void> }}
   */
  createSession(): SpeechSession {
    const sessionId = ++this.sessionId;
    const isStale = () => sessionId !== this.sessionId;
    const controller = new AbortController();
    this.speakAbort = controller;
    let chain: Promise<void> = Promise.resolve();

    const push = (sentence: string) => {
      const text = sentence.trim().slice(0, MAX_TTS_CHARS);
      if (!text) {
        return;
      }

      // Start synthesis immediately so it overlaps with playback of earlier clips.
      const clip = isStale()
        ? Promise.resolve(null)
        : fetchSpeechClip(text, controller.signal);

      chain = chain.then(async () => {
        if (isStale()) return;
        const blob = await clip;
        if (isStale()) return;

        if (blob) {
          await this.playClip(blob, isStale, text);
        } else {
          // Fall back to browser speech if server TTS is unavailable (no API key).
          await this.playWithSpeechSynthesis(text, isStale);
        }
      });
    };

    return {
      push,
      finished: () =>
        chain.then(() => {
          // Whole answer voiced: drop the caption once the queue drains.
          if (!isStale()) {
            this.clearCaptionTimer();
            this.onCaption(null);
          }
        })
    };
  }

  /**
   * Plays back the learner's just-transcribed sentence as a caption, in the
   * same rolling style as the teacher's. There is no audio to sync to, so the
   * reveal is paced by an estimate.
   */
  showUserCaption(text: string): void {
    const segmented = segmentText(text);
    if (segmented.words.length === 0) return;
    this.startWordReveal(
      segmented,
      segmented.words.length * ESTIMATED_WORD_SECONDS * 1000,
      "user"
    );
  }

  /**
   * Reveals the sentence one word at a time, pacing the reveal to fit
   * `durationMs` so the caption tracks the audio.
   */
  private startWordReveal(
    segmented: SegmentedText,
    durationMs: number,
    speaker: CaptionSpeaker
  ): void {
    const { words, spaced, rtl } = segmented;
    this.clearCaptionTimer();
    if (words.length === 0) {
      this.onCaption(null);
      return;
    }

    let spoken = 1;
    this.onCaption({ speaker, words, spoken, spaced, rtl });
    if (words.length === 1) {
      return;
    }

    const step = Math.max(140, durationMs / words.length);
    this.captionTimer = window.setInterval(() => {
      spoken += 1;
      this.onCaption({ speaker, words, spoken: Math.min(spoken, words.length), spaced, rtl });
      if (spoken >= words.length) {
        this.clearCaptionTimer();
      }
    }, step);
  }

  private playClip(blob: Blob, isStale: () => boolean, text: string): Promise<void> {
    return new Promise<void>((resolve) => {
      const audio = this.audio ?? new Audio();
      this.audio = audio;
      revokeBlobUrl(audio.src);

      const segmented = segmentText(text);
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        this.onSpeakingChange(false);
        resolve();
      };

      audio.src = URL.createObjectURL(blob);
      audio.onplay = () => {
        this.onSpeakingChange(true);
        // Prefer the real clip length; fall back to an estimate if unknown.
        const seconds =
          Number.isFinite(audio.duration) && audio.duration > 0
            ? audio.duration
            : segmented.words.length * ESTIMATED_WORD_SECONDS;
        this.startWordReveal(segmented, seconds * 1000, "teacher");
      };
      audio.onended = finish;
      audio.onerror = finish;
      audio.onpause = () => {
        // stopSpeaking() pauses playback; release the chain so it can unwind.
        if (isStale()) {
          finish();
        }
      };
      audio.play().catch(finish);
    });
  }

  private playWithSpeechSynthesis(text: string, isStale: () => boolean): Promise<void> {
    return new Promise<void>((resolve) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window) || isStale()) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = SPEECH_SYNTHESIS_RATE;

      const segmented = segmentText(text);
      const { words, offsets, spaced, rtl } = segmented;
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        this.onSpeakingChange(false);
        resolve();
      };

      utterance.onstart = () => {
        this.onSpeakingChange(true);
        // The browser reports real word boundaries; estimate as a safety net only.
        this.startWordReveal(
          segmented,
          words.length * ESTIMATED_WORD_SECONDS * 1000,
          "teacher"
        );
      };
      // Boundary events give exact word timing — far better than the estimate.
      utterance.onboundary = (event) => {
        if (event.name !== "word") return;
        const spoken = countWordsUpTo(offsets, event.charIndex);
        if (spoken > 0) {
          this.clearCaptionTimer();
          this.onCaption({
            speaker: "teacher",
            words,
            spoken: Math.min(spoken, words.length),
            spaced,
            rtl
          });
        }
      };
      utterance.onend = finish;
      utterance.onerror = finish;
      window.speechSynthesis.speak(utterance);
    });
  }
}

/** Counts how many words begin at or before `charIndex`. */
function countWordsUpTo(offsets: number[], charIndex: number): number {
  let count = 0;
  for (const offset of offsets) {
    if (offset <= charIndex) {
      count += 1;
    } else {
      break;
    }
  }
  return count;
}

function revokeBlobUrl(url: string): void {
  if (url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}
