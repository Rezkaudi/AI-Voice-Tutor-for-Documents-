import { memo } from "react";
import { cx } from "@/lib/uiClasses";
import type { AvatarState } from "@/types";
import {
  avatarStyleFor,
  container,
  haloLayer1,
  haloLayer2
} from "@/styles/components/workspace/teacher/teacherAvatar";
import { AvatarFace } from "./AvatarFace";
import { WaveBars } from "./WaveBars";

interface TeacherAvatarProps {
  state: AvatarState;
  className?: string;
}

function TeacherAvatarComponent({ state, className }: TeacherAvatarProps) {
  const { haloTone, haloAnimation, headAnimation, activeHalo, listening, speaking, thinking } =
    avatarStyleFor(state);

  return (
    <div
      className={cx(container, className ?? "mt-1 w-[clamp(180px,26vh,260px)]")}
      aria-hidden
    >
      <span
        className={cx(
          haloLayer1,
          haloTone,
          activeHalo && "opacity-100",
          activeHalo && haloAnimation,
          thinking && "opacity-[0.7] animate-halo-spin"
        )}
      />
      <span
        className={cx(
          haloLayer2,
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
