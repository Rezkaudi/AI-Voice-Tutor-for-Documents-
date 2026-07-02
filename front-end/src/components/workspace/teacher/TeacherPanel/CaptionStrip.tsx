import { Fragment } from "react";
import { cx } from "@/lib/uiClasses";
import { WORD_BOLD, WORD_CODE, WORD_ITALIC, WORD_QUOTED } from "@/lib/textSegmentation";
import type { SpeechCaption } from "@/types";
import { captionBase } from "@/styles/components/workspace/teacher/teacherPanel";
import {
  dotBase,
  dotTutor,
  dotUser,
  userBorder,
  wordActiveTutor,
  wordActiveUser,
  wordBase,
  wordBoldColor,
  wordCode,
  wordCodeColor,
  wordDefaultColor,
  wordQuotedColor,
  wordRow
} from "@/styles/components/workspace/teacher/captionStrip";

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
      className={cx(captionBase, isUser && userBorder)}
      dir={caption.rtl ? "rtl" : "ltr"}
      aria-hidden="true"
    >
      <span className={cx(dotBase, isUser ? dotUser : dotTutor)} />

      <span className={wordRow}>
        <span className="block">
          {words.map((text, index) => {
            const isActive = index === activeIndex;
            const flags = caption.styles[index] ?? 0;
            return (
              <Fragment key={index}>

                {spaced && index > 0 ? " " : ""}
                <span
                  className={cx(
                    wordBase,
                    (flags & WORD_BOLD) !== 0 ? "font-extrabold" : "font-semibold",
                    (flags & (WORD_ITALIC | WORD_QUOTED)) !== 0 && "italic",
                    (flags & WORD_CODE) !== 0 && wordCode,
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
    return isUser ? wordActiveUser : wordActiveTutor;
  }
  if ((flags & WORD_CODE) !== 0) return wordCodeColor;
  if ((flags & WORD_QUOTED) !== 0) return wordQuotedColor;
  if ((flags & WORD_BOLD) !== 0) return wordBoldColor;
  return wordDefaultColor;
}
