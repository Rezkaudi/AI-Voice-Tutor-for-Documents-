import { AlertTriangle, Clock, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSessionStore } from "@/store/sessionStore";
import { cx, ui } from "@/lib/uiClasses";
import {
  errorBanner,
  hint,
  prepIcon,
  prepIconError,
  progressBar,
  progressTrack
} from "@/styles/components/workspace/teacher/pagePreparingDialog";

export function PagePreparingDialog() {
  const { t } = useTranslation();
  const preparing = useSessionStore((s) => s.preparingPages);
  const error = useSessionStore((s) => s.prepareError);
  const updating = useSessionStore((s) => s.callMode);
  const retry = useSessionStore((s) => s.retryPreparePages);
  const cancel = useSessionStore((s) => s.cancelPreparePages);

  const open = preparing || Boolean(error);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !preparing) cancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, preparing, cancel]);

  if (!open) return null;

  const context = updating ? "update" : "start";

  return (
    <div className={ui.modalBackdrop}>
      <div
        className={cx(ui.modalCard, "gap-4!")}
        role="dialog"
        aria-modal="true"
        aria-labelledby="prep-title"
        aria-describedby="prep-body"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={ui.modalHead}>
          <div
            className={cx(ui.modalIcon, error ? prepIconError : prepIcon)}
            aria-hidden
          >
            {error ? <AlertTriangle size={17} /> : <Sparkles size={17} />}
          </div>
          <div>
            <h3 id="prep-title" className={ui.modalTitle}>
              {error
                ? t("dialogs.preparing.errorTitle")
                : t(`dialogs.preparing.${context}Title`)}
            </h3>
            <p id="prep-body" className={ui.modalBody}>
              {error
                ? t("dialogs.preparing.errorBody")
                : t(`dialogs.preparing.${context}Body`)}
            </p>
          </div>
        </div>

        {error ? (
          <>
            <p className={errorBanner} role="alert">
              {error}
            </p>
            <div className={ui.modalActions}>
              <button className={ui.button} type="button" onClick={cancel}>
                <X size={16} aria-hidden />
                {t("common.cancel")}
              </button>
              <button
                className={cx(ui.button, ui.buttonPrimary)}
                type="button"
                onClick={() => void retry()}
                autoFocus
              >
                <RotateCcw size={16} aria-hidden />
                {t("dialogs.preparing.retry")}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2.5" aria-live="polite">
              <div className="flex items-center justify-center gap-2 text-[0.9rem] font-[650] text-accent-ink">
                <Loader2 size={16} className={cx(ui.spin, "motion-reduce:animate-none")} aria-hidden />
                {t("dialogs.preparing.status")}
              </div>
              <div
                className={progressTrack}
                role="progressbar"
                aria-label={t("dialogs.preparing.status")}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className={progressBar} aria-hidden />
              </div>
            </div>
            <p className={hint}>
              <Clock size={13} aria-hidden />
              {t("dialogs.preparing.hint")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
