import { AlertTriangle } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";

interface MicStatusBannerProps {
  micSupported: boolean;
  micBlocked: boolean;
  onOpenHelp: () => void;
}

export function MicStatusBanner({ micSupported, micBlocked, onOpenHelp }: MicStatusBannerProps) {
  const { t } = useTranslation();

  if (!micSupported) {
    return (
      <p className="m-0 inline-flex items-center gap-1.5 text-[0.82rem] text-[oklch(0.85_0.1_70)]">
        <AlertTriangle size={14} aria-hidden /> {t("teacher.micUnsupported")}
      </p>
    );
  }

  if (micBlocked) {
    return (
      <button
        type="button"
        className="m-0 inline-flex max-w-lg cursor-pointer items-center gap-1.5 rounded-full border border-[oklch(0.55_0.13_45/0.6)] bg-[oklch(0.28_0.07_40/0.55)] px-3.5 py-2 text-start text-[0.82rem] leading-[1.4] text-[oklch(0.9_0.07_60)] transition-[background] duration-150 ease-out hover:bg-[oklch(0.32_0.08_40/0.7)] [&_svg]:shrink-0"
        onClick={onOpenHelp}
      >
        <AlertTriangle size={14} aria-hidden />
        <span>
          <Trans i18nKey="teacher.micBlocked" components={{ strong: <strong /> }} />
        </span>
      </button>
    );
  }

  return null;
}
