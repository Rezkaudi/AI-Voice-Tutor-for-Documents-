import { Fragment } from "react";
import { cx } from "@/lib/uiClasses";
import { WORD_BOLD, WORD_CODE, WORD_ITALIC, WORD_QUOTED } from "@/lib/textSegmentation";
import type { SpeechCaption } from "@/types";
import { captionBase } from "./styles";

interface CaptionStripProps {
  caption: SpeechCaption;
}

export function CaptionStrip({ caption }: CaptionStripProps) {
  const words = caption.spoken > 0 ? caption.words.slice(0, caption.spoken) : [];
  if (words.length === 0) return null;

  const activeIndex = caption.spoken - 1;
  const spaced = caption.spaced;
  const isUser = caption.speaker === "user";

  return (
    <div
      className={cx(captionBase, isUser && "border-[oklch(0.78_0.14_150/0.34)]")}
      dir={caption.rtl ? "rtl" : "ltr"}
      aria-hidden="true"
    >
      <span
        className={cx(
          "h-[9px] w-[9px] flex-none rounded-full",
          isUser
            ? "bg-[oklch(0.8_0.14_150)] shadow-[0_0_8px_oklch(0.78_0.14_150/0.75)]"
            : "bg-[oklch(0.82_0.13_90)] shadow-[0_0_8px_oklch(0.85_0.13_90/0.75)]"
        )}
      />

      <span className="flex max-h-[2lh] min-w-0 flex-1 items-end overflow-hidden text-[clamp(0.9rem,2.3vh,1.12rem)] leading-[1.4] min-[920px]:text-[clamp(1.18rem,3vh,1.58rem)]">
        <span className="block">
          {words.map((text, index) => {
            const isActive = index === activeIndex;
            const flags = caption.styles[index] ?? 0;
            return (
              <Fragment key={index}>

                {spaced && index > 0 ? " " : ""}
                <span
                  className={cx(
                    "transition-colors duration-160 ease-out",
                    (flags & WORD_BOLD) !== 0 ? "font-extrabold" : "font-semibold",
                    (flags & (WORD_ITALIC | WORD_QUOTED)) !== 0 && "italic",
                    (flags & WORD_CODE) !== 0 &&
                      "rounded-[5px] bg-[oklch(0.32_0.025_215/0.65)] px-[4px] font-mono",
                    wordColor(flags, isActive, isUser)
                  )}
                >
                  {text}
                </span>
              </Fragment>
            );
          })}
        </span>
      </span>
    </div>
  );
}

function wordColor(flags: number, isActive: boolean, isUser: boolean): string {
  if (isActive) {
    return isUser
      ? "text-[oklch(0.92_0.12_150)] [text-shadow:0_0_12px_oklch(0.78_0.14_150/0.5)]"
      : "text-[oklch(0.97_0.035_95)] [text-shadow:0_0_12px_oklch(0.85_0.13_90/0.5)]";
  }
  if ((flags & WORD_CODE) !== 0) return "text-[oklch(0.85_0.07_160)]";
  if ((flags & WORD_QUOTED) !== 0) return "text-[oklch(0.8_0.06_220)]";
  if ((flags & WORD_BOLD) !== 0) return "text-[oklch(0.87_0.03_95)]";
  return "text-[oklch(0.68_0.015_215)]";
}
