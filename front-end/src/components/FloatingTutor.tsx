import { GripVertical } from "lucide-react";
import { cx } from "@/lib/uiClasses";
import { useDraggable } from "@/lib/useDraggable";
import type { AvatarState } from "@/lib/types";
import { TeacherAvatar } from "./TeacherAvatar";

const STORAGE_KEY = "tutorPuckPos";

const RING_BY_STATE: Record<AvatarState, string> = {
  speaking: "border-[oklch(0.82_0.13_90/0.85)] shadow-[0_0_0_3px_oklch(0.82_0.13_90/0.28),0_18px_40px_oklch(0.05_0.02_244/0.6)]",
  listening: "border-[oklch(0.8_0.14_150/0.85)] shadow-[0_0_0_3px_oklch(0.8_0.14_150/0.3),0_18px_40px_oklch(0.05_0.02_244/0.6)]",
  thinking: "border-[oklch(0.74_0.12_230/0.85)] shadow-[0_0_0_3px_oklch(0.74_0.12_230/0.28),0_18px_40px_oklch(0.05_0.02_244/0.6)]",
  "idle-call": "border-[oklch(1_0_0/0.22)] shadow-[0_16px_38px_oklch(0.05_0.02_244/0.55)]",
  idle: "border-[oklch(1_0_0/0.16)] shadow-[0_16px_38px_oklch(0.05_0.02_244/0.55)]"
};

interface FloatingTutorProps {
  state: AvatarState;
  statusLabel: string;
}

export function FloatingTutor({ state, statusLabel }: FloatingTutorProps) {
  const { ref, pos, dragging, handlers } = useDraggable(STORAGE_KEY, () => ({
    x: 10,
    y: window.innerHeight - 10
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
      className={cx(
        "fixed z-30 flex touch-none select-none flex-col items-center",
        dragging ? "cursor-grabbing" : "cursor-grab"
      )}
      role="img"
      aria-label="AI teacher — drag to reposition"
      title="Drag to move the teacher"
    >
      <div
        className={cx(
          "relative grid h-[clamp(76px,17vw,96px)] w-[clamp(76px,17vw,96px)] place-items-center overflow-hidden rounded-full border bg-[radial-gradient(120%_120%_at_50%_15%,oklch(0.32_0.06_232),oklch(0.19_0.03_244))] backdrop-blur-[6px] transition-[box-shadow,border-color,transform] duration-200 ease-out",
          dragging && "scale-[1.04]",
          RING_BY_STATE[state]
        )}
      >
        <TeacherAvatar state={state} className="w-[116%]" />
        {/* Drag affordance — a faint grip that fades in on hover/drag. */}
        <span
          className={cx(
            "pointer-events-none absolute right-1 top-1 text-[oklch(1_0_0/0.5)] opacity-0 transition-opacity duration-200",
            dragging && "opacity-70"
          )}
          aria-hidden
        >
          <GripVertical size={14} />
        </span>
      </div>
      {statusLabel ? (
        <span
          className="mt-1.5 max-w-[150px] truncate rounded-full border border-[oklch(1_0_0/0.12)] bg-[oklch(0.14_0.022_244/0.82)] px-2.5 py-1 text-center text-[0.72rem] font-semibold text-[oklch(0.9_0.02_215)] shadow-[0_6px_16px_oklch(0.05_0.02_244/0.5)] backdrop-blur-[6px]"
          aria-hidden
        >
          {statusLabel}
        </span>
      ) : null}
    </div>
  );
}
