import { Mic, MessageCircleQuestion, X } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "@/lib/uiClasses";
import {
  backdrop,
  badge,
  card,
  closeButton,
  dialogWrap,
  footer,
  header,
  micCore,
  micCoreActive,
  micCoreIdle,
  micIdleRing,
  micPingInner,
  micPingOuter,
  micPulseWrap,
  questionText
} from "@/styles/components/workspace/teacher/questionPopup";

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
      <div className={backdrop} aria-hidden onClick={onDismiss} />
      <div
        className={dialogWrap}
        role="dialog"
        aria-modal="false"
        aria-labelledby="question-popup-title"
        aria-describedby="question-popup-text"
      >
        <div className={card}>

          <div className={header}>
            <span className={badge}>
              <MessageCircleQuestion size={13} aria-hidden />
              {t("question.badge")}
            </span>
            <button
              type="button"
              onClick={onDismiss}
              aria-label={t("question.dismiss")}
              className={closeButton}
            >
              <X size={17} aria-hidden />
            </button>
          </div>

          <div className="px-5 pb-4 pt-2.5">
            <p id="question-popup-title" className="sr-only">
              {t("question.title")}
            </p>
            <p id="question-popup-text" dir="auto" className={questionText}>
              {question}
            </p>
          </div>

          <div className={footer} aria-live="polite">
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
    <span className={micPulseWrap} aria-hidden>
      {active ? (
        <>
          <span className={micPingOuter} />
          <span className={micPingInner} />
        </>
      ) : (
        <span className={micIdleRing} />
      )}
      <span className={cx(micCore, active ? micCoreActive : micCoreIdle)}>
        <Mic size={18} />
      </span>
    </span>
  );
}
