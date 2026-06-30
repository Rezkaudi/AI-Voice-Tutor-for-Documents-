import type { SegmentedText } from "@/types";
import type { CaptionController } from "./CaptionController";
import { ESTIMATED_WORD_SECONDS, SPEECH_SYNTHESIS_RATE } from "./constants";

interface SynthDeps {
  segmented: SegmentedText;
  isStale: () => boolean;
  caption: CaptionController;
  onSpeakingChange: (speaking: boolean) => void;
  onStart?: (durationMs: number) => void;
}

export function playWithSpeechSynthesis({
  segmented,
  isStale,
  caption,
  onSpeakingChange,
  onStart
}: SynthDeps): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || isStale()) {
      resolve();
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(segmented.clean);
    utterance.rate = SPEECH_SYNTHESIS_RATE;

    const { words, offsets, styles, spaced, rtl } = segmented;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      onSpeakingChange(false);
      resolve();
    };

    const estimatedMs = words.length * ESTIMATED_WORD_SECONDS * 1000;
    utterance.onstart = () => {
      if (isStale()) return;
      onSpeakingChange(true);

      caption.reveal(segmented, estimatedMs, "teacher");
      onStart?.(estimatedMs);
    };

    utterance.onboundary = (event) => {
      if (event.name !== "word" || isStale()) return;
      const spoken = countWordsUpTo(offsets, event.charIndex);
      if (spoken > 0) {
        caption.show({
          speaker: "teacher",
          words,
          styles,
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

function countWordsUpTo(offsets: number[], charIndex: number): number {
  let count = 0;
  for (const offset of offsets) {
    if (offset <= charIndex) count += 1;
    else break;
  }
  return count;
}
