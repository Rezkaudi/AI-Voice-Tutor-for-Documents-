import type { AvatarState } from "@/types";

export const ringByState: Record<AvatarState, string> = {
  speaking: "border-[oklch(0.82_0.13_90/0.85)]",
  listening: "border-[oklch(0.8_0.14_150/0.85)]",
  thinking: "border-[oklch(0.74_0.12_230/0.85)]",
  "idle-call": "border-[oklch(1_0_0/0.22)]",
  idle: "border-[oklch(1_0_0/0.16)]"
};

export const puck =
  "fixed z-30 flex touch-none select-none flex-col items-center";

export const ring =
  "h-[clamp(76px,17vw,96px)] w-[clamp(76px,17vw,96px)] rounded-full border transition-[box-shadow,border-color,transform] duration-200 ease-out";

export const face =
  "relative grid h-full w-full place-items-center overflow-hidden rounded-full bg-[radial-gradient(120%_120%_at_50%_15%,oklch(0.32_0.06_232),oklch(0.19_0.03_244))] backdrop-blur-[6px]";

export const grip =
  "pointer-events-none absolute right-1 top-1 text-[oklch(1_0_0/0.5)] opacity-0 transition-opacity duration-200";

export const thinkingPill =
  "pointer-events-none mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-[oklch(0.74_0.12_230/0.5)] bg-[oklch(0.15_0.022_244/0.9)] px-2.5 py-1 text-[0.72rem] font-semibold text-[oklch(0.82_0.06_225)] shadow-[0_8px_20px_oklch(0.05_0.02_244/0.5)] backdrop-blur-[8px] animate-caption-rise motion-reduce:animate-none";

export const thinkingDots = "text-[oklch(0.74_0.12_230)]";
