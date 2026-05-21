import { segmentText } from "@/lib/textSegmentation";
import type { CaptionController } from "./CaptionController";
import { ESTIMATED_WORD_SECONDS, SPEECH_SYNTHESIS_RATE } from "./constants";

interface SynthDeps {
  text: string;
  isStale: () => boolean;
  caption: CaptionController;
  onSpeakingChange: (speaking: boolean) => void;
}

/** Browser SpeechSynthesis fallback used when server TTS is unavailable. */
export function playWithSpeechSynthesis({
  text,
  isStale,
  caption,
  onSpeakingChange
}: SynthDeps): Promise<void> {
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
      onSpeakingChange(false);
      resolve();
    };

    utterance.onstart = () => {
      onSpeakingChange(true);
      // The browser reports real word boundaries; estimate as a safety net only.
      caption.reveal(segmented, words.length * ESTIMATED_WORD_SECONDS * 1000, "teacher");
    };
    // Boundary events give exact word timing — far better than the estimate.
    utterance.onboundary = (event) => {
      if (event.name !== "word") return;
      const spoken = countWordsUpTo(offsets, event.charIndex);
      if (spoken > 0) {
        caption.show({
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

/** Counts how many words begin at or before `charIndex`. */
function countWordsUpTo(offsets: number[], charIndex: number): number {
  let count = 0;
  for (const offset of offsets) {
    if (offset <= charIndex) count += 1;
    else break;
  }
  return count;
}
