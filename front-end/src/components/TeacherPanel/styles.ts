export const cornerButton =
  "absolute top-3 z-20 inline-flex min-h-10 min-w-10 items-center justify-center gap-[7px] rounded-full border border-[oklch(1_0_0/0.26)] bg-[oklch(0.17_0.025_244/0.74)] px-3 max-[480px]:px-2.5 sm:px-[15px] text-[0.8rem] font-semibold tracking-[0.01em] text-[oklch(0.97_0.01_215)] shadow-[0_6px_18px_oklch(0.1_0.03_244/0.5)] backdrop-blur-[10px] [transition:transform_160ms_cubic-bezier(0.16,1,0.3,1),background-color_160ms_ease-out,border-color_160ms_ease-out] disabled:cursor-not-allowed disabled:opacity-[0.42] [&:hover:not(:disabled)]:-translate-y-px [&:hover:not(:disabled)]:border-[oklch(0.78_0.13_165/0.7)] [&:hover:not(:disabled)]:bg-[oklch(0.22_0.03_244/0.85)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.78_0.13_165)]";

export const cornerLabel = "hidden sm:inline";

export const cornerButtonActive =
  "border-transparent! bg-[oklch(0.82_0.13_165)]! text-[oklch(0.18_0.04_230)]! [&:hover:not(:disabled)]:border-transparent! [&:hover:not(:disabled)]:bg-[oklch(0.86_0.13_165)]!";

export const bubbleBase =
  "w-fit max-w-[92%] whitespace-pre-wrap rounded-[14px] px-[13px] py-2.5 text-[0.94rem] leading-[1.55] [&_p]:mb-1.5 [&_p]:mt-0 [&_p:last-child]:mb-0";

export const callHint =
  "text-center text-[0.92rem] leading-[1.55] text-[oklch(0.82_0.02_215)] px-3";

// Occupies the panel grid's flexible middle row (between the status block
// and the call controls) and centers in it via the grid's place-items-center.
// Sharing the row with the transcript instead of using absolute offsets keeps
// it vertically centered at every panel height without pushing siblings.
// Fixed width (not max-w): the box must not shrink-wrap short phrases, or it
// would resize on every revealed word — the two-line window inside handles
// overflow instead.
export const captionBase =
  "pointer-events-none z-30 col-start-1 row-start-3 flex w-[min(640px,calc(100%_-_24px))] flex-nowrap items-center gap-2.5 rounded-2xl border border-[oklch(1_0_0/0.1)] bg-[oklch(0.13_0.022_244/0.9)] px-[18px] py-[11px] shadow-[0_14px_36px_oklch(0.05_0.02_244/0.6)] backdrop-blur-[10px] animate-caption-rise motion-reduce:animate-none";

export const langOptionBase =
  "min-h-[38px] appearance-none rounded-full border-0 bg-transparent px-4 py-2 text-[0.8rem] font-semibold leading-none text-[oklch(0.78_0.02_215)] transition-colors duration-160 ease-out disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.78_0.13_165)] [&:hover:not(:disabled)]:bg-[oklch(0.3_0.03_230)] [&:hover:not(:disabled)]:text-[oklch(0.92_0.01_215)]";

export const langOptionActive =
  "bg-[oklch(0.78_0.13_165)]! text-[oklch(0.18_0.04_230)]!";

export const callButtonBase =
  "relative grid h-[72px] w-[72px] place-items-center rounded-full border-0 text-[oklch(0.99_0.005_100)] shadow-[0_10px_24px_oklch(0.18_0.04_244/0.5)] transition-[transform,box-shadow,filter,background-position] duration-160 ease-out disabled:cursor-not-allowed disabled:opacity-50 [&:active:not(:disabled)]:translate-y-0 [&:active:not(:disabled)]:scale-[0.98] [&:hover:not(:disabled)]:-translate-y-px [&:hover:not(:disabled)]:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[oklch(0.82_0.09_200)]";

export const callButtonEnd =
  "animate-listen-pulse-slow bg-[linear-gradient(to_bottom,oklch(0.53_0.045_27),oklch(0.6_0.24_27))] bg-[length:100%_200%] [background-position:50%_0%] [transition-duration:320ms] [&:hover:not(:disabled)]:[background-position:50%_100%]";

export const callButtonStart =
  "bg-[linear-gradient(140deg,oklch(0.66_0.14_154),oklch(0.5_0.13_162))]";

export const micCircleBase =
  "relative grid h-[72px] w-[72px] place-items-center rounded-full border border-[oklch(0.46_0.04_230)] bg-[oklch(0.32_0.035_232)] text-[oklch(0.94_0.012_100)] shadow-[0_8px_22px_oklch(0.12_0.03_244/0.45)] transition-[transform,background,border-color,box-shadow] duration-160 ease-out disabled:cursor-not-allowed disabled:opacity-[0.42] [&:hover:not(:disabled)]:-translate-y-px [&:hover:not(:disabled)]:bg-[oklch(0.38_0.04_232)] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[oklch(0.82_0.09_200)]";

export const micCircleActive =
  "animate-speak-pulse border-[oklch(0.7_0.13_154)] bg-[linear-gradient(140deg,oklch(0.66_0.14_154),oklch(0.5_0.13_162))] text-[oklch(0.99_0.008_138)]";
