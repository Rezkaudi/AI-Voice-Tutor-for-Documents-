import type { SegmentedText } from "@/lib/types";
import type { CaptionController } from "./CaptionController";
import { ESTIMATED_WORD_SECONDS, SPEECH_SYNTHESIS_RATE } from "./constants";

interface SynthDeps {
  segmented: SegmentedText;
  isStale: () => boolean;
  caption: CaptionController;
  onSpeakingChange: (speaking: boolean) => void;
  onStart?: (durationMs: number) => void;
}

/** Browser SpeechSynthesis fallback used when server TTS is unavailable. */
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
    // Speak the markdown-stripped text — `offsets` index into it, so the
    // boundary events' charIndex lines up with caption words exactly.
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
      onSpeakingChange(true);
      // The browser reports real word boundaries; estimate as a safety net only.
      caption.reveal(segmented, estimatedMs, "teacher");
      onStart?.(estimatedMs);
    };
    // Boundary events give exact word timing — far better than the estimate.
    utterance.onboundary = (event) => {
      if (event.name !== "word") return;
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

/** Counts how many words begin at or before `charIndex`. */
function countWordsUpTo(offsets: number[], charIndex: number): number {
  let count = 0;
  for (const offset of offsets) {
    if (offset <= charIndex) count += 1;
    else break;
  }
  return count;
}
