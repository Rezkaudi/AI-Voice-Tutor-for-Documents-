import { GripVertical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "@/lib/uiClasses";
import { useDraggable } from "@/hooks/useDraggable";
import type { AvatarState } from "@/types";
import {
  face,
  grip,
  puck,
  ring,
  ringByState,
  thinkingDots,
  thinkingPill
} from "@/styles/components/workspace/teacher/floatingTutor";
import { TeacherAvatar } from "./TeacherAvatar";
import { ThinkingDots } from "./TeacherPanel/ThinkingDots";

const STORAGE_KEY = "tutorPuckPos";

interface FloatingTutorProps {
  state: AvatarState;
  thinking?: boolean;
}

export function FloatingTutor({ state, thinking = false }: FloatingTutorProps) {
  const { t } = useTranslation();
  const { ref, pos, dragging, handlers } = useDraggable(STORAGE_KEY, () => ({
    x: Number.MAX_SAFE_INTEGER,
    y: 10
  }));

  const ready = pos !== null;

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      {...handlers}
      style={{
        left: pos?.x ?? -9999,
        top: pos?.y ?? -9999,
        visibility: ready ? "visible" : "hidden"
      }}
      className={cx(puck, dragging ? "cursor-grabbing" : "cursor-grab")}
      role="img"
      aria-label={t("teacher.avatarLabel")}
      title={t("teacher.dragTitle")}
    >

      <div className={cx(ring, dragging && "scale-[1.04]", ringByState[state])}>
        <div className={face}>
          <TeacherAvatar state={state} className="w-[116%]" />

          <span className={cx(grip, dragging && "opacity-70")} aria-hidden>
            <GripVertical size={14} />
          </span>
        </div>
      </div>

      {thinking ? (
        <div className={thinkingPill} role="status" aria-live="polite">
          {t("teacher.thinking")}
          <ThinkingDots className={thinkingDots} />
        </div>
      ) : null}
    </div>
  );
}
