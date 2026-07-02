export const overlayBase =
  "fixed inset-0 z-40 bg-[oklch(0.1_0.02_244/0.5)] backdrop-blur-[2px] transition-opacity duration-300 ease-out motion-reduce:transition-none";

export const overlayOpen = "opacity-100";

export const overlayClosed = "pointer-events-none opacity-0";

export const aside =
  "fixed inset-y-0 right-0 z-50 flex w-[min(420px,92vw)] flex-col border-l border-[oklch(1_0_0/0.1)] bg-[radial-gradient(120%_80%_at_50%_0%,oklch(0.26_0.04_236)_0%,oklch(0.18_0.03_244)_70%)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none";

export const asideOpen = "translate-x-0 shadow-[-24px_0_60px_oklch(0.05_0.02_244/0.6)]";

export const asideClosed = "translate-x-full shadow-none";

export const header =
  "flex items-center justify-between gap-3 border-b border-[oklch(1_0_0/0.1)] px-4 pb-3 pt-[calc(env(safe-area-inset-top)+14px)] text-[oklch(0.96_0.008_100)]";

export const title = "m-0 text-[1.02rem] font-bold tracking-[0.01em]";

export const closeButton =
  "grid h-9 w-9 place-items-center rounded-full border border-[oklch(1_0_0/0.16)] bg-[oklch(0.24_0.03_240/0.7)] text-[oklch(0.95_0.01_215)] transition-colors duration-150 ease-out [&:hover:not(:disabled)]:bg-[oklch(0.32_0.035_238/0.85)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.82_0.13_165)]";

export const body =
  "flex min-h-0 flex-1 flex-col px-2 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2 text-[oklch(0.96_0.008_100)]";
