import { memo, type CSSProperties } from "react";
import { cx } from "@/lib/uiClasses";
import type { AvatarState } from "@/lib/types";

const WAVE_BAR_COUNT = 9;

interface TeacherAvatarProps {
  state: AvatarState;
}

type WaveBarStyle = CSSProperties & { "--i": number };

/** Animated illustrated teacher whose expression reflects the call state. */
function TeacherAvatarComponent({ state }: TeacherAvatarProps) {
  const listening = state === "listening";
  const speaking = state === "speaking";
  const thinking = state === "thinking";
  const activeHalo = state === "idle-call" || listening || speaking;
  const haloTone = listening
    ? "bg-[radial-gradient(circle,oklch(0.78_0.14_150/0.45)_0%,transparent_65%)]"
    : speaking
      ? "bg-[radial-gradient(circle,oklch(0.85_0.13_90/0.4)_0%,transparent_65%)]"
      : "bg-[radial-gradient(circle,oklch(0.78_0.12_200/0.35)_0%,transparent_65%)]";
  const haloAnimation = listening
    ? "animate-halo-pulse"
    : speaking
      ? "animate-halo-pulse-fast"
      : "animate-halo-breath";
  const headAnimation = speaking
    ? "animate-speak-bob"
    : listening
      ? "animate-head-tilt"
      : "animate-head-breath";

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
      <svg
        className={cx(
          "relative z-2 h-full w-full transition-[transform,filter] duration-220 ease-out filter-[drop-shadow(0_14px_26px_oklch(0.18_0.04_244/0.55))]",
          state === "idle" &&
            "filter-[drop-shadow(0_12px_22px_oklch(0.18_0.04_244/0.45))_saturate(0.95)]",
          thinking && "animate-think-bob"
        )}
        viewBox="0 0 200 220"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="face" cx="35%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#fde3c8" />
            <stop offset="60%" stopColor="#f5c79b" />
            <stop offset="100%" stopColor="#d99a6a" />
          </radialGradient>
          <linearGradient id="hair" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a2a1f" />
            <stop offset="100%" stopColor="#1f1410" />
          </linearGradient>
          <linearGradient id="suit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3f7cc7" />
            <stop offset="100%" stopColor="#1f3f7a" />
          </linearGradient>
          <radialGradient id="cheek" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ff9b8a" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ff9b8a" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* shoulders / suit */}
        <path
          d="M30 220 C 40 175, 70 160, 100 160 C 130 160, 160 175, 170 220 Z"
          fill="url(#suit)"
        />
        <path d="M88 162 L100 178 L112 162 L108 200 L92 200 Z" fill="#f5f1ea" />
        <circle cx="100" cy="186" r="3.5" fill="#3f7cc7" />

        {/* neck */}
        <rect x="88" y="148" width="24" height="18" rx="6" fill="#e5b489" />

        {/* head */}
        <g className={cx("origin-[100px_110px]", headAnimation)}>
          <circle cx="100" cy="100" r="52" fill="url(#face)" />
          <path
            d="M50 104 C 46 60, 72 42, 100 42 C 132 42, 156 62, 150 104 C 146 92, 138 86, 132 86 C 122 78, 108 76, 94 78 C 82 80, 74 80, 68 84 C 60 86, 54 94, 50 104 Z"
            fill="url(#hair)"
          />
          <ellipse cx="51" cy="104" rx="6" ry="9" fill="#e5b489" />
          <ellipse cx="149" cy="104" rx="6" ry="9" fill="#e5b489" />

          <circle cx="74" cy="116" r="9" fill="url(#cheek)" />
          <circle cx="126" cy="116" r="9" fill="url(#cheek)" />

          <g className="animate-blink origin-center">
            <ellipse cx="82" cy="102" rx="6.5" ry="7.5" fill="#fff" />
            <circle cx="82" cy="103" r="3.4" fill="#1c1a17" />
            <circle cx="83.5" cy="101" r="1.1" fill="#fff" />
          </g>
          <g className="animate-blink [animation-delay:0.06s] origin-center">
            <ellipse cx="118" cy="102" rx="6.5" ry="7.5" fill="#fff" />
            <circle cx="118" cy="103" r="3.4" fill="#1c1a17" />
            <circle cx="119.5" cy="101" r="1.1" fill="#fff" />
          </g>

          <path
            d="M73 91 Q 82 87 91 91"
            stroke="#2b1d15"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M109 91 Q 118 87 127 91"
            stroke="#2b1d15"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />

          <g fill="none" stroke="#1c1a17" strokeWidth="2">
            <circle cx="82" cy="102" r="11" />
            <circle cx="118" cy="102" r="11" />
            <path d="M93 102 L 107 102" />
            <path d="M71 99 L 60 96" />
            <path d="M129 99 L 140 96" />
          </g>

          <path
            d="M100 110 Q 96 122 100 126 Q 104 124 102 120"
            stroke="#b9805a"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          />

          <g className="mouth">
            <ellipse
              className={cx(
                "opacity-0 transform-fill origin-center",
                speaking && "animate-mouth-open opacity-100"
              )}
              cx="100"
              cy="138"
              rx="9"
              ry="3"
              fill="#3a1a18"
            />
            <rect
              className={cx(
                "opacity-100 transform-fill origin-center",
                speaking && "opacity-0"
              )}
              x="92"
              y="137"
              width="16"
              height="2.4"
              rx="1.2"
              fill="#3a1a18"
            />
            <path
              className={cx("opacity-0", speaking && "animate-tongue-show opacity-100")}
              d="M94 139 Q 100 144 106 139 Z"
              fill="#d24a4a"
            />
          </g>
        </g>

        {/* tiny AI antenna */}
        <g className="antenna">
          <line x1="100" y1="48" x2="100" y2="36" stroke="#2b1d15" strokeWidth="2" strokeLinecap="round" />
          <circle cx="100" cy="33" r="4" fill="#2dd4a4">
            <animate attributeName="opacity" values="1;0.4;1" dur="1.6s" repeatCount="indefinite" />
          </circle>
        </g>
      </svg>

      <div
        className={cx(
          "absolute bottom-[-2px] left-1/2 z-3 flex h-[22px] -translate-x-1/2 items-end gap-1 opacity-0 transition-opacity duration-200 ease-out",
          (listening || speaking) && "opacity-100"
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
    </div>
  );
}

export const TeacherAvatar = memo(TeacherAvatarComponent);
