import { segmentText } from "@/lib/textSegmentation";
import type { CaptionController } from "./CaptionController";
import { ESTIMATED_WORD_SECONDS } from "./constants";

interface PlayClipDeps {
  audio: HTMLAudioElement;
  blob: Blob;
  text: string;
  isStale: () => boolean;
  caption: CaptionController;
  onSpeakingChange: (speaking: boolean) => void;
}

export function playAudioClip({
  audio,
  blob,
  text,
  isStale,
  caption,
  onSpeakingChange
}: PlayClipDeps): Promise<void> {
  return new Promise<void>((resolve) => {
    revokeBlobUrl(audio.src);

    const segmented = segmentText(text);
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      onSpeakingChange(false);
      resolve();
    };

    audio.src = URL.createObjectURL(blob);
    audio.onplay = () => {
      onSpeakingChange(true);
      // Prefer the real clip length; fall back to an estimate if unknown.
      const seconds =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : segmented.words.length * ESTIMATED_WORD_SECONDS;
      caption.reveal(segmented, seconds * 1000, "teacher");
    };
    audio.onended = finish;
    audio.onerror = finish;
    audio.onpause = () => {
      // stopSpeaking() pauses playback; release the chain so it can unwind.
      if (isStale()) finish();
    };
    audio.play().catch(finish);
  });
}

export function revokeBlobUrl(url: string): void {
  if (url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}
