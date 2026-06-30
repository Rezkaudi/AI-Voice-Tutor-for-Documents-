import type { CSSProperties } from "react";
import { cx } from "@/lib/uiClasses";

const WAVE_BAR_COUNT = 9;

type WaveBarStyle = CSSProperties & { "--i": number };

interface WaveBarsProps {
  visible: boolean;
  listening: boolean;
}

export function WaveBars({ visible, listening }: WaveBarsProps) {
  return (
    <div
      className={cx(
        "absolute bottom-[-2px] left-1/2 z-3 flex h-[22px] -translate-x-1/2 items-end gap-1 opacity-0 transition-opacity duration-200 ease-out",
        visible && "opacity-100"
      )}
      aria-hidden
    >
      {Array.from({ length: WAVE_BAR_COUNT }).map((_, index) => (
        <span
          key={index}
          className={cx(
            "h-1.5 w-1 animate-wave-bar rounded-full bg-[linear-gradient(180deg,oklch(0.9_0.12_95),oklch(0.7_0.16_70))] [animation-delay:calc(var(--i)*70ms)]",
            listening &&
              "bg-[linear-gradient(180deg,oklch(0.88_0.14_150),oklch(0.62_0.16_154))]"
          )}
          style={{ "--i": index } as WaveBarStyle}
        />
      ))}
    </div>
  );
}
