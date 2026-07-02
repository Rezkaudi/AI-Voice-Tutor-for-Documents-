export const wrapLarge = "pointer-events-auto absolute end-4 top-4 z-50";

export const wrapSmall =
  "pointer-events-auto fixed bottom-[calc(env(safe-area-inset-bottom)+12px)] end-3 z-50";

export const popoverPosLarge = "top-[calc(100%+10px)] end-0 origin-top-right";

export const popoverPosSmall = "bottom-[calc(100%+10px)] end-0 origin-bottom-right";

export const popover =
  "absolute z-50 w-[212px] animate-modal-pop rounded-xl border border-[oklch(1_0_0/0.12)] bg-[oklch(0.16_0.022_244/0.96)] p-1 shadow-[0_24px_60px_oklch(0.05_0.02_244/0.6)] backdrop-blur-[16px]";

export const triggerBase =
  "grid h-10 w-10 place-items-center rounded-full border shadow-[0_10px_26px_oklch(0.05_0.02_244/0.5)] backdrop-blur-[12px] transition-[transform,background,border-color] duration-150 ease-out [&:hover:not(:disabled)]:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.82_0.13_165)]";

export const triggerOpen =
  "border-transparent bg-[oklch(0.82_0.13_165)] text-[oklch(0.18_0.04_230)]";

export const triggerClosed =
  "border-[oklch(1_0_0/0.12)] bg-[oklch(0.15_0.022_244/0.86)] text-[oklch(0.95_0.01_215)]";
