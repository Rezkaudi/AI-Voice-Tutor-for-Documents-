import { MicOff } from "lucide-react";
import { useEffect } from "react";
import { Trans, useTranslation } from "react-i18next";
import { cx, ui } from "@/lib/uiClasses";

const ENABLE_STEP_KEYS = [
  "dialogs.mic.step1",
  "dialogs.mic.step2",
  "dialogs.mic.step3",
  "dialogs.mic.step4"
] as const;

interface MicPermissionDialogProps {
  open: boolean;
  onClose: () => void;
}

export function MicPermissionDialog({ open, onClose }: MicPermissionDialogProps) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className={ui.modalBackdrop} onClick={onClose}>
      <div
        className={ui.modalCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mic-perm-title"
        aria-describedby="mic-perm-body"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={ui.modalHead}>
          <div className={ui.modalIcon} aria-hidden>
            <MicOff size={20} />
          </div>
          <div>
            <h3 id="mic-perm-title" className={ui.modalTitle}>
              {t("dialogs.mic.title")}
            </h3>
            <p id="mic-perm-body" className={ui.modalBody}>
              {t("dialogs.mic.body")}
            </p>
          </div>
        </div>

        <ol className={ui.micSteps}>
          {ENABLE_STEP_KEYS.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ol>

        <p className={ui.micNote}>
          <Trans i18nKey="dialogs.mic.note" components={{ strong: <strong /> }} />
        </p>

        <div className={ui.modalActions}>
          <button className={cx(ui.button, ui.buttonPrimary)} type="button" onClick={onClose} autoFocus>
            {t("dialogs.mic.gotIt")}
          </button>
        </div>
      </div>
    </div>
  );
}
