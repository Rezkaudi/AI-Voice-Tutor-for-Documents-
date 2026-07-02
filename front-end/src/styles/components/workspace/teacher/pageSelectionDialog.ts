export const iconOverride =
  "h-8! w-8! border-[oklch(0.82_0.07_165)]! bg-[oklch(0.95_0.04_165)]! text-[oklch(0.45_0.13_165)]!";

export const counter =
  "flex items-center justify-between text-[0.78rem] font-semibold text-[oklch(0.42_0.02_244)]";

export const grid =
  "grid max-h-[42vh] grid-cols-[repeat(auto-fill,minmax(42px,1fr))] gap-1.5 overflow-y-auto overscroll-contain rounded-xl border border-line bg-paper p-2.5 pr-2 [scrollbar-color:oklch(0.7_0.03_86)_transparent] scrollbar-thin [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[oklch(0.7_0.03_86/0.6)] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5";

export const pageButtonBase =
  "relative grid aspect-square min-h-[38px] place-items-center rounded-lg border text-[0.8rem] font-bold transition-[transform,background,border-color,box-shadow] duration-140 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40";

export const pageButtonActive =
  "border-transparent bg-accent text-[oklch(0.98_0.01_138)] shadow-app";

export const pageButtonIdle =
  "border-line bg-paper-strong text-ink [&:hover:not(:disabled)]:-translate-y-px [&:hover:not(:disabled)]:border-accent [&:hover:not(:disabled)]:shadow-app";

export const fade =
  "pointer-events-none absolute inset-x-2 bottom-px h-7 rounded-b-xl bg-linear-to-t from-paper to-transparent";
