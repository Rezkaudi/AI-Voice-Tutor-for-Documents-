import { GripVertical } from "lucide-react";
import { cx } from "@/lib/uiClasses";
import { useDraggable } from "@/lib/useDraggable";
import type { AvatarState } from "@/lib/types";
import { TeacherAvatar } from "./TeacherAvatar";

const STORAGE_KEY = "tutorPuckPos";

const RING_BY_STATE: Record<AvatarState, string> = {
  speaking: "border-[oklch(0.82_0.13_90/0.85)]",
  listening: "border-[oklch(0.8_0.14_150/0.85)]",
  thinking: "border-[oklch(0.74_0.12_230/0.85)]",
  "idle-call": "border-[oklch(1_0_0/0.22)]",
  idle: "border-[oklch(1_0_0/0.16)]"
};

interface FloatingTutorProps {
  state: AvatarState;
}

export function FloatingTutor({ state }: FloatingTutorProps) {
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
      className={cx(
        "fixed z-30 flex touch-none select-none flex-col items-center",
        dragging ? "cursor-grabbing" : "cursor-grab"
      )}
      role="img"
      aria-label="AI teacher — drag to reposition"
      title="Drag to move the teacher"
    >
      {/* Outer wrapper carries the shadow/ring but is NOT clipped. On iOS Safari,
          a box-shadow on an element that also has overflow-hidden + border-radius +
          backdrop-filter renders the shadow as a rectangle; keeping the shadow here
          and the clip/blur on the inner element avoids that bug. */}
      <div
        className={cx(
          "h-[clamp(76px,17vw,96px)] w-[clamp(76px,17vw,96px)] rounded-full border transition-[box-shadow,border-color,transform] duration-200 ease-out",
          dragging && "scale-[1.04]",
          RING_BY_STATE[state]
        )}
      >
        <div className="relative grid h-full w-full place-items-center overflow-hidden rounded-full bg-[radial-gradient(120%_120%_at_50%_15%,oklch(0.32_0.06_232),oklch(0.19_0.03_244))] backdrop-blur-[6px]">
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
      </div>
    </div>
  );
}
