import type { AvatarState } from "@/lib/types";

interface AvatarStyleSet {
  haloTone: string;
  haloAnimation: string;
  headAnimation: string;
  activeHalo: boolean;
  listening: boolean;
  speaking: boolean;
  thinking: boolean;
}

export function avatarStyleFor(state: AvatarState): AvatarStyleSet {
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

  return { haloTone, haloAnimation, headAnimation, activeHalo, listening, speaking, thinking };
}
