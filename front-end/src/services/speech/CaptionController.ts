import type { CaptionSpeaker, SegmentedText, SpeechCaption } from "@/lib/types";

type CaptionListener = (caption: SpeechCaption | null) => void;

/** Owns the word-reveal timer and pushes caption updates to a listener. */
export class CaptionController {
  private timer: number | null = null;

  constructor(private emit: CaptionListener) {}

  setListener(emit: CaptionListener): void {
    this.emit = emit;
  }

  /** Stops the rolling timer and clears the visible caption. */
  reset(): void {
    this.clearTimer();
    this.emit(null);
  }

  clearTimer(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Pushes a single caption snapshot, e.g. from a precise boundary event. */
  show(caption: SpeechCaption): void {
    this.clearTimer();
    this.emit(caption);
  }

  /** Reveals words one at a time, pacing the reveal to fit `durationMs`. */
  reveal(segmented: SegmentedText, durationMs: number, speaker: CaptionSpeaker): void {
    const { words, styles, spaced, rtl } = segmented;
    this.clearTimer();
    if (words.length === 0) {
      this.emit(null);
      return;
    }

    let spoken = 1;
    this.emit({ speaker, words, styles, spoken, spaced, rtl });
    if (words.length === 1) return;

    const step = Math.max(140, durationMs / words.length);
    this.timer = window.setInterval(() => {
      spoken += 1;
      this.emit({ speaker, words, styles, spoken: Math.min(spoken, words.length), spaced, rtl });
      if (spoken >= words.length) {
        this.clearTimer();
      }
    }, step);
  }
}
