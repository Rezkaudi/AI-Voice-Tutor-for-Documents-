import type { CaptionSpeaker, SegmentedText, SpeechCaption } from "@/types";

type CaptionListener = (caption: SpeechCaption | null) => void;

export class CaptionController {
  private timer: number | null = null;
  private active: {
    segmented: SegmentedText;
    speaker: CaptionSpeaker;
    step: number;
    spoken: number;
  } | null = null;

  constructor(private emit: CaptionListener) {}

  setListener(emit: CaptionListener): void {
    this.emit = emit;
  }

  reset(): void {
    this.clearTimer();
    this.active = null;
    this.emit(null);
  }

  clearTimer(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  show(caption: SpeechCaption): void {
    this.clearTimer();
    this.active = null;
    this.emit(caption);
  }

  reveal(segmented: SegmentedText, durationMs: number, speaker: CaptionSpeaker): void {
    const { words } = segmented;
    this.clearTimer();
    if (words.length === 0) {
      this.active = null;
      this.emit(null);
      return;
    }

    const step = Math.max(140, durationMs / words.length);
    this.active = { segmented, speaker, step, spoken: 1 };
    this.emitActive();
    if (words.length === 1) {
      this.active = null;
      return;
    }
    this.startTicking();
  }

  pause(): void {
    this.clearTimer();
  }

  resume(): void {
    if (!this.active) return;
    if (this.active.spoken >= this.active.segmented.words.length) return;
    this.startTicking();
  }

  private startTicking(): void {
    if (!this.active) return;
    this.timer = window.setInterval(() => {
      if (!this.active) return;
      this.active.spoken += 1;
      this.emitActive();
      if (this.active.spoken >= this.active.segmented.words.length) {
        this.clearTimer();
        this.active = null;
      }
    }, this.active.step);
  }

  private emitActive(): void {
    if (!this.active) return;
    const { segmented, speaker, spoken } = this.active;
    const { words, styles, spaced, rtl } = segmented;
    this.emit({
      speaker,
      words,
      styles,
      spoken: Math.min(spoken, words.length),
      spaced,
      rtl
    });
  }
}
