import type { AvatarState } from "@/types";

export const container = "relative grid aspect-[1/1.05] place-items-center";

export const haloLayer1 = "pointer-events-none absolute inset-[-6%] z-1 rounded-full opacity-0";

export const haloLayer2 = "pointer-events-none absolute inset-[-18%] z-1 rounded-full opacity-0";

const haloListening =
  "bg-[radial-gradient(circle,oklch(0.78_0.14_150/0.45)_0%,transparent_65%)]";

const haloSpeaking =
  "bg-[radial-gradient(circle,oklch(0.85_0.13_90/0.4)_0%,transparent_65%)]";

const haloIdle =
  "bg-[radial-gradient(circle,oklch(0.78_0.12_200/0.35)_0%,transparent_65%)]";

/** Maps the avatar's high-level state to the halo/head classes that drive its animations. */
export function avatarStyleFor(state: AvatarState) {
  const listening = state === "listening";
  const speaking = state === "speaking";
  const thinking = state === "thinking";
  const activeHalo = state === "idle-call" || listening || speaking;

  const haloTone = listening ? haloListening : speaking ? haloSpeaking : haloIdle;

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
