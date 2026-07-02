import { Phone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "@/lib/uiClasses";
import { useSessionStore } from "@/store/sessionStore";
import { useVoiceStore } from "@/store/voiceStore";
import { halo, startButton } from "@/styles/components/workspace/controls/startCallButton";

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
        <span aria-hidden className={halo} />
      ) : null}
      <button
        type="button"
        className={cx(startButton, startBtnSize)}
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
