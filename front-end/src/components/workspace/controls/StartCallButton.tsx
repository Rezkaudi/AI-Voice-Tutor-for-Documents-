import { Phone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "@/lib/uiClasses";
import { useSessionStore } from "@/store/sessionStore";
import { useVoiceStore } from "@/store/voiceStore";

interface StartCallButtonProps {
  large?: boolean;
}

/** Idle-state control: the button that opens page selection and starts a call. */
export function StartCallButton({ large = false }: StartCallButtonProps) {
  const { t } = useTranslation();

  const startBtnSize = large ? "h-[3.5rem] gap-2.5 px-9 text-[1.05rem]" : "h-12 w-12";
  const startIconSize = large ? 21 : 18;

  const handleCallToggle = useSessionStore((s) => s.handleCallToggle);
  const isSupported = useVoiceStore((s) => s.isSupported);
  const permission = useVoiceStore((s) => s.permission);

  const micBlocked = permission === "denied";

  return (
    <div className="pointer-events-auto relative grid place-items-center">
      {isSupported && !micBlocked ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full bg-[oklch(0.62_0.14_154)] blur-[3px] animate-halo-pulse motion-reduce:hidden"
        />
      ) : null}
      <button
        type="button"
        className={cx(
          "relative inline-flex items-center justify-center rounded-full bg-[linear-gradient(140deg,oklch(0.68_0.15_154),oklch(0.5_0.13_162))] font-bold tracking-[0.01em] text-[oklch(0.99_0.005_100)] ring-1 ring-inset ring-[oklch(1_0_0/0.18)] shadow-[0_14px_34px_oklch(0.45_0.1_154/0.45),inset_0_1px_0_oklch(1_0_0/0.25)] transition-[transform,filter] duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none [&:active:not(:disabled)]:scale-[0.97] [&:hover:not(:disabled)]:-translate-y-px [&:hover:not(:disabled)]:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[oklch(0.82_0.09_200)]",
          startBtnSize
        )}
        aria-label={t("controls.session.startAria")}
        onClick={handleCallToggle}
        disabled={!isSupported || micBlocked}
      >
        <Phone size={startIconSize} aria-hidden />
        {large ? <span>{t("controls.session.start")}</span> : null}
      </button>
    </div>
  );
}
