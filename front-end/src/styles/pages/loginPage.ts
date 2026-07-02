export const main =
  "relative grid h-dvh w-full place-items-center overflow-hidden bg-paper text-ink";

export const header =
  "absolute inset-x-0 top-0 z-20 flex items-center justify-between p-5 sm:p-7";

export const brand = "text-[0.95rem] font-[760] tracking-tight";

export const section =
  "relative z-10 mx-auto grid w-full max-w-6xl items-center gap-8 px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10";

export const leftCol = "order-2 mx-auto max-w-xl text-center lg:order-1 lg:mx-0 lg:text-left";

export const headline =
  "text-[clamp(2rem,5vw,3.5rem)] font-[820] leading-[1.03] tracking-[-0.022em]";

export const subtitle =
  "mx-auto mt-4 max-w-[46ch] text-[1.02rem] leading-[1.55] text-muted lg:mx-0";

export const benefitList = "mt-6 flex flex-wrap justify-center gap-2 lg:justify-start";

export const ctaExtra =
  "w-full justify-center gap-3 !rounded-xl !px-6 !py-3.5 text-[1rem] font-[720] shadow-app sm:w-auto";

export const footer =
  "absolute inset-x-0 bottom-0 z-20 hidden justify-center p-4 text-[0.75rem] text-muted sm:flex";

export const avatarHalo =
  "pointer-events-none absolute h-[min(72vw,440px)] w-[min(72vw,440px)] rounded-full bg-[radial-gradient(circle_at_50%_42%,oklch(0.86_0.035_210/0.6)_0%,oklch(0.58_0.11_154/0.16)_46%,transparent_70%)] motion-safe:animate-halo-breath";

export const avatarPlaceholder =
  "relative z-1 grid h-[min(58vh,360px)] w-[min(72vw,360px)] place-items-center rounded-[28px] border border-dashed border-line bg-paper-strong/70 px-6 text-center";

export const avatarImg =
  "relative z-1 max-h-[62vh] w-[min(78vw,440px)] select-none object-contain drop-shadow-[0_24px_45px_oklch(0.22_0.02_245/0.18)]";

export const backdropBlob1 =
  "absolute -right-32 -top-40 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,oklch(0.86_0.035_210/0.5),transparent_70%)] blur-2xl";

export const backdropBlob2 =
  "absolute -bottom-44 -left-32 h-[460px] w-[460px] rounded-full bg-[radial-gradient(circle,oklch(0.78_0.09_154/0.3),transparent_70%)] blur-2xl";
