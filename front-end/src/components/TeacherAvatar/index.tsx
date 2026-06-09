import { memo } from "react";
import { cx } from "@/lib/uiClasses";
import type { AvatarState } from "@/lib/types";
import { AvatarFace } from "./AvatarFace";
import { WaveBars } from "./WaveBars";
import { avatarStyleFor } from "./avatarStyles";

interface TeacherAvatarProps {
  state: AvatarState;
}

/** Animated illustrated teacher whose expression reflects the call state. */
function TeacherAvatarComponent({ state }: TeacherAvatarProps) {
  const styles = avatarStyleFor(state);
  const { haloTone, haloAnimation, headAnimation, activeHalo, listening, speaking, thinking } =
    styles;

  return (
    <div
      className="relative mt-1 grid aspect-[1/1.05] w-[clamp(180px,26vh,260px)] place-items-center"
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
