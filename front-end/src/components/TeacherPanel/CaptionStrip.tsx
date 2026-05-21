import { cx } from "@/lib/uiClasses";
import type { SpeechCaption } from "@/lib/types";
import { captionBase } from "./styles";

// Trailing words kept on the one-line caption; older words drop off as the
// teacher speaks, so the strip always fits without clipping.
const CAPTION_WINDOW = 6;

interface CaptionStripProps {
  caption: SpeechCaption;
}

/**
 * Live caption — a video-style subtitle strip. Decorative: word-by-word
 * updates would flood a screen reader, and the panel's status label already
 * carries the live region.
 */
export function CaptionStrip({ caption }: CaptionStripProps) {
  const start = caption.spoken > 0 ? Math.max(0, caption.spoken - CAPTION_WINDOW) : 0;
  const words = caption.spoken > 0 ? caption.words.slice(start, caption.spoken) : [];
  if (words.length === 0) return null;

  const activeIndex = caption.spoken - 1;
  const speaker = caption.speaker;
  const spaced = caption.spaced;
  const isUser = speaker === "user";

  return (
    <div
      className={cx(captionBase, isUser && "border-[oklch(0.78_0.14_150/0.34)]")}
      dir={caption.rtl ? "rtl" : "ltr"}
      aria-hidden="true"
    >
      <span
        className={cx(
          "flex-none whitespace-nowrap rounded-full px-[9px] py-[3px] text-[0.62rem] font-bold uppercase tracking-[0.07em]",
          isUser
            ? "bg-[oklch(0.8_0.14_150)] text-[oklch(0.17_0.04_150)]"
            : "bg-[oklch(0.82_0.13_90)] text-[oklch(0.18_0.04_60)]"
        )}
      >
        {isUser ? "You" : "Teacher"}
      </span>
      <span className="block min-w-0 flex-[0_1_auto] overflow-hidden whitespace-nowrap text-center">
        {words.map((text, i) => {
          const index = start + i;
          const isActive = index === activeIndex;
          return (
            <span
              key={index}
              className={cx(
                "text-[clamp(1.02rem,2.5vh,1.32rem)] font-semibold leading-[1.35] text-[oklch(0.68_0.015_215)] transition-colors duration-160 ease-out",
                isActive &&
                  (isUser
                    ? "text-[oklch(0.92_0.12_150)] [text-shadow:0_0_12px_oklch(0.78_0.14_150/0.5)]"
                    : "text-[oklch(0.97_0.035_95)] [text-shadow:0_0_12px_oklch(0.85_0.13_90/0.5)]")
              )}
            >
              {spaced && i > 0 ? " " : ""}
              {text}
            </span>
          );
        })}
      </span>
    </div>
  );
}
