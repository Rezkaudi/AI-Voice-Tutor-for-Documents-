type ClassValue = string | false | null | undefined;

export function cx(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}

const focusAccent = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const controlBase =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[oklch(0.74_0.025_86)] bg-paper-strong text-ink transition-[transform,border-color,background] duration-[140ms] ease-out [&:hover:not(:disabled)]:-translate-y-px [&:hover:not(:disabled)]:border-accent";

export const ui = {
  focusAccent,
  spin: "animate-spin-fast",
  surface: "rounded-lg border border-line bg-paper-strong shadow-app",
  pill:
    "inline-flex min-h-[30px] items-center gap-[7px] whitespace-nowrap rounded-full border border-line bg-paper-strong px-[9px] py-[5px] text-[0.8rem] text-muted",
  button: cx(controlBase, focusAccent, "px-[13px] py-[9px] font-[680]"),
  buttonPrimary: "border-accent bg-accent text-[oklch(0.98_0.01_138)]",
  buttonDanger: cx(
    controlBase,
    focusAccent,
    "!border-danger !bg-danger !px-3 !py-2 font-bold !text-[oklch(0.99_0.005_100)] [&:hover:not(:disabled)]:!border-danger [&:hover:not(:disabled)]:brightness-110"
  ),
  iconButton: cx(controlBase, focusAccent, "w-10 p-0"),
  buttonRow: "flex flex-wrap items-center justify-center gap-2.5",
  introTitle: "mb-2 mt-2.5 text-[clamp(1.55rem,4vw,2.5rem)] leading-[1.04]",
  introCopy: "mx-auto my-0 max-w-[58ch] text-muted leading-[1.55]",
  errorText: "font-[680] text-danger",
  modalBackdrop:
    "fixed inset-0 z-[90] grid place-items-center bg-[oklch(0.18_0.03_244_/_0.55)] p-5 backdrop-blur-[6px] [-webkit-backdrop-filter:blur(6px)] animate-modal-fade",
  modalCard:
    "grid w-[min(440px,100%)] gap-3.5 rounded-[14px] border border-line bg-paper-strong px-[22px] pb-[18px] pt-[22px] shadow-[0_28px_70px_oklch(0.18_0.03_244_/_0.35)] animate-modal-pop",
  modalHead: "flex items-start gap-3",
  modalIcon:
    "grid h-[38px] w-[38px] flex-none place-items-center rounded-[10px] border border-[oklch(0.86_0.06_35)] bg-[oklch(0.96_0.04_35)] text-[oklch(0.55_0.16_35)]",
  modalTitle: "m-0 text-[1.05rem] font-bold tracking-normal text-ink",
  modalBody: "mb-0 mt-1 text-[0.94rem] leading-normal text-[oklch(0.42_0.02_244)]",
  modalActions: "mt-1 flex justify-end gap-2",
  micSteps:
    "m-0 flex flex-col gap-2 pl-[1.15rem] text-[0.9rem] leading-normal text-ink marker:font-bold marker:text-accent",
  micNote:
    "m-0 rounded-[10px] border border-[oklch(0.88_0.05_150)] bg-[oklch(0.96_0.02_150)] px-3 py-2.5 text-[0.84rem] leading-normal text-[oklch(0.4_0.05_150)]"
};
