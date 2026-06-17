import { memo } from "react";
import { cx } from "@/lib/uiClasses";
import type { AvatarState } from "@/lib/types";
import { AvatarFace } from "./AvatarFace";
import { WaveBars } from "./WaveBars";
import { avatarStyleFor } from "./avatarStyles";

interface TeacherAvatarProps {
  state: AvatarState;
  /** Override the sizing/spacing utilities (e.g. for the compact floating puck). */
  className?: string;
}

/** Animated illustrated teacher whose expression reflects the call state. */
function TeacherAvatarComponent({ state, className }: TeacherAvatarProps) {
  const styles = avatarStyleFor(state);
  const { haloTone, haloAnimation, headAnimation, activeHalo, listening, speaking, thinking } =
    styles;

  return (
    <div
      className={cx(
        "relative grid aspect-[1/1.05] place-items-center",
        className ?? "mt-1 w-[clamp(180px,26vh,260px)]"
      )}
      aria-hidden
    >
      <span
        className={cx(
          "pointer-events-none absolute inset-[-6%] z-1 rounded-full opacity-0",
          haloTone,
          activeHalo && "opacity-100",
          activeHalo && haloAnimation,
          thinking && "opacity-[0.7] animate-halo-spin"
        )}
      />
      <span
        className={cx(
          "pointer-events-none absolute inset-[-18%] z-1 rounded-full opacity-0",
          haloTone,
          activeHalo && "opacity-100",
          activeHalo && haloAnimation,
          listening && "[animation-delay:0.5s]",
          speaking && "[animation-delay:0.2s]"
        )}
      />
      <AvatarFace
        headAnimation={headAnimation}
        speaking={speaking}
        thinking={thinking}
        state={state}
      />
      <WaveBars visible={speaking} listening={false} />
    </div>
  );
}

export const TeacherAvatar = memo(TeacherAvatarComponent);
