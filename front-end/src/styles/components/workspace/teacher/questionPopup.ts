export const backdrop =
  "absolute inset-0 z-20 animate-modal-fade bg-[oklch(0.22_0.03_244/0.42)] backdrop-blur-[3px] [-webkit-backdrop-filter:blur(3px)]";

export const dialogWrap =
  "pointer-events-none absolute inset-0 z-80 grid place-items-center justify-center p-4";

export const card =
  "pointer-events-auto w-[min(460px,100%)] overflow-hidden rounded-[18px] border border-line bg-paper-strong text-ink shadow-[0_28px_70px_oklch(0.18_0.03_244/0.35)] animate-modal-pop";

export const header = "flex items-center justify-between gap-3 px-5 pt-4";

export const badge =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-[0.08em] border border-[oklch(0.82_0.07_165)] bg-[oklch(0.95_0.04_165)] text-[oklch(0.42_0.13_165)]";

export const closeButton =
  "grid h-8 w-8 place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-[oklch(0.92_0.01_244)] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export const questionText =
  "m-0 text-[1.18rem] font-semibold leading-[1.4] text-balance text-ink";

export const footer =
  "flex items-center gap-3 border-t border-line bg-paper px-5 py-3.5";

export const micPulseWrap = "relative grid h-11 w-11 flex-none place-items-center";

export const micPingOuter = "absolute inset-0 animate-ping rounded-full bg-[oklch(0.7_0.12_165/0.35)]";

export const micPingInner = "absolute inset-0 rounded-full bg-[oklch(0.7_0.12_165/0.16)]";

export const micIdleRing = "absolute inset-0 rounded-full bg-[oklch(0.9_0.01_244)]";

export const micCore = "relative grid h-9 w-9 place-items-center rounded-full transition-colors duration-200";

export const micCoreActive = "bg-[oklch(0.55_0.13_165)] text-[oklch(0.99_0.01_165)]";

export const micCoreIdle = "bg-[oklch(0.86_0.02_244)] text-muted";
