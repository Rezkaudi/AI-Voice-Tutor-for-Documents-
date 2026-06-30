import { Mic, MessageCircleQuestion, X } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "@/lib/uiClasses";

interface QuestionPopupProps {
  question: string | null;
  isListening: boolean;
  isTranscribing: boolean;
  onDismiss: () => void;
}

export function QuestionPopup({
  question,
  isListening,
  isTranscribing,
  onDismiss
}: QuestionPopupProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!question) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [question, onDismiss]);

  if (!question) return null;

  const statusKey = isTranscribing
    ? "question.transcribing"
    : isListening
      ? "question.listening"
      : "question.getReady";

  return (
    <>
      <div
        className={cx(
          "absolute inset-0 z-20 animate-modal-fade",
          "bg-[oklch(0.22_0.03_244/0.42)] backdrop-blur-[3px] [-webkit-backdrop-filter:blur(3px)]"
        )}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 z-80 grid place-items-center justify-center p-4"
        role="dialog"
        aria-modal="false"
        aria-labelledby="question-popup-title"
        aria-describedby="question-popup-text"
      >
        <div
          className={cx(
            "pointer-events-auto w-[min(460px,100%)] overflow-hidden rounded-[18px]",
            "border border-line bg-paper-strong text-ink",
            "shadow-[0_28px_70px_oklch(0.18_0.03_244/0.35)] animate-modal-pop"
          )}
        >

          <div className="flex items-center justify-between gap-3 px-5 pt-4">
            <span
              className={cx(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
                "text-[0.7rem] font-bold uppercase tracking-[0.08em]",
                "border border-[oklch(0.82_0.07_165)] bg-[oklch(0.95_0.04_165)] text-[oklch(0.42_0.13_165)]"
              )}
            >
              <MessageCircleQuestion size={13} aria-hidden />
              {t("question.badge")}
            </span>
            <button
              type="button"
              onClick={onDismiss}
              aria-label={t("question.dismiss")}
              className={cx(
                "grid h-8 w-8 place-items-center rounded-full text-muted",
                "transition-colors duration-150 hover:bg-[oklch(0.92_0.01_244)] hover:text-ink",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              )}
            >
              <X size={17} aria-hidden />
            </button>
          </div>

          <div className="px-5 pb-4 pt-2.5">
            <p id="question-popup-title" className="sr-only">
              {t("question.title")}
            </p>
            <p
              id="question-popup-text"
              dir="auto"
              className="m-0 text-[1.18rem] font-semibold leading-[1.4] text-balance text-ink"
            >
              {question}
            </p>
          </div>

          <div
            className="flex items-center gap-3 border-t border-line bg-paper px-5 py-3.5"
            aria-live="polite"
          >
            <MicPulse active={isListening} />
            <div className="min-w-0">
              <p className="m-0 text-[0.92rem] font-semibold text-ink">{t(statusKey)}</p>
              <p className="m-0 mt-0.5 text-[0.78rem] leading-snug text-muted">
                {t("question.hint")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function MicPulse({ active }: { active: boolean }) {
  return (
    <span className="relative grid h-11 w-11 flex-none place-items-center" aria-hidden>
      {active ? (
        <>
          <span className="absolute inset-0 animate-ping rounded-full bg-[oklch(0.7_0.12_165/0.35)]" />
          <span className="absolute inset-0 rounded-full bg-[oklch(0.7_0.12_165/0.16)]" />
        </>
      ) : (
        <span className="absolute inset-0 rounded-full bg-[oklch(0.9_0.01_244)]" />
      )}
      <span
        className={cx(
          "relative grid h-9 w-9 place-items-center rounded-full transition-colors duration-200",
          active
            ? "bg-[oklch(0.55_0.13_165)] text-[oklch(0.99_0.01_165)]"
            : "bg-[oklch(0.86_0.02_244)] text-muted"
        )}
      >
        <Mic size={18} />
      </span>
    </span>
  );
}
