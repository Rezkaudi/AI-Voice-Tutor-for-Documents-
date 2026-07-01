import type { SegmentedText } from "@/types";
import type { CaptionController } from "./CaptionController";
import { ESTIMATED_WORD_SECONDS } from "./constants";

interface PlayClipDeps {
  audio: HTMLAudioElement;
  blob: Blob;
  segmented: SegmentedText;
  isStale: () => boolean;
  isPaused: () => boolean;
  caption: CaptionController;
  onSpeakingChange: (speaking: boolean) => void;
  onStart?: (durationMs: number) => void;
}

export function playAudioClip({
  audio,
  blob,
  segmented,
  isStale,
  isPaused,
  caption,
  onSpeakingChange,
  onStart
}: PlayClipDeps): Promise<void> {
  return new Promise<void>((resolve) => {
    revokeBlobUrl(audio.src);

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      onSpeakingChange(false);
      resolve();
    };

    audio.src = URL.createObjectURL(blob);
    let started = false;
    audio.onplay = () => {
      if (isStale()) return;
      onSpeakingChange(true);

      if (started) return;
      started = true;

      const seconds =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : segmented.words.length * ESTIMATED_WORD_SECONDS;
      caption.reveal(segmented, seconds * 1000, "teacher");
      onStart?.(seconds * 1000);
    };
    audio.onended = finish;
    audio.onerror = finish;
    audio.onpause = () => {

      if (isStale()) finish();
    };
    if (!isPaused()) audio.play().catch(finish);
  });
}

export function revokeBlobUrl(url: string): void {
  if (url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}
