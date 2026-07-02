import { BookOpen, Check, Phone, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { MAX_LESSON_PAGES } from "@/lib/constants";
import { cx, ui } from "@/lib/uiClasses";
import {
  counter,
  fade,
  grid,
  iconOverride,
  pageButtonActive,
  pageButtonBase,
  pageButtonIdle
} from "@/styles/components/workspace/teacher/pageSelectionDialog";

interface PageSelectionDialogProps {

  pageCount: number;

  selectedPages: number[];

  callMode: boolean;
  onConfirm: (pages: number[]) => void;
  onCancel: () => void;
}

function normalize(pages: number[], pageCount: number): number[] {
  return Array.from(new Set(pages))
    .filter((page) => page >= 1 && page <= pageCount)
    .sort((a, b) => a - b)
    .slice(0, MAX_LESSON_PAGES);
}

export function PageSelectionDialog({
  pageCount,
  selectedPages,
  callMode,
  onConfirm,
  onCancel
}: PageSelectionDialogProps) {
  const { t } = useTranslation();
  const [chosen, setChosen] = useState<number[]>(() =>
    normalize(selectedPages, pageCount)
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const atLimit = chosen.length >= MAX_LESSON_PAGES;
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);

  const toggle = (page: number) => {
    setChosen((prev) => {
      if (prev.includes(page)) return prev.filter((p) => p !== page);
      if (prev.length >= MAX_LESSON_PAGES) return prev;
      return [...prev, page].sort((a, b) => a - b);
    });
  };

  const confirm = () => onConfirm(chosen.length > 0 ? chosen : [1]);

  return (
    <div className={ui.modalBackdrop} onClick={onCancel}>
      <div
        className={cx(ui.modalCard, "max-h-[88vh] gap-3! overflow-hidden")}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pages-title"
        aria-describedby="pages-body"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={cx(ui.modalHead, "gap-2.5")}>
          <div className={cx(ui.modalIcon, iconOverride)} aria-hidden>
            <BookOpen size={17} />
          </div>
          <div>
            <h3 id="pages-title" className={cx(ui.modalTitle, "text-[0.98rem]!")}>
              {t("dialogs.pages.title")}
            </h3>
            <p id="pages-body" className={cx(ui.modalBody, "text-[0.8rem]! leading-snug!")}>
              {t("dialogs.pages.body", { max: MAX_LESSON_PAGES })}
            </p>
          </div>
        </div>

        <div className={counter} aria-live="polite">
          <span>
            {t("dialogs.pages.selected", { count: chosen.length, max: MAX_LESSON_PAGES })}
          </span>
          {chosen.length > 0 ? (
            <span className="font-medium text-muted">
              {t("dialogs.pages.teaching", { pages: chosen.join(", ") })}
            </span>
          ) : null}
        </div>

        <div className="relative -mx-1">
          <div className={grid}>
            {pages.map((page) => {
              const active = chosen.includes(page);
              const disabled = !active && atLimit;
              return (
                <button
                  key={page}
                  type="button"
                  aria-pressed={active}
                  aria-label={t("dialogs.pages.pageLabel", { page })}
                  title={
                    disabled
                      ? t("dialogs.pages.pageAtMost", { max: MAX_LESSON_PAGES })
                      : t("dialogs.pages.pageLabel", { page })
                  }
                  disabled={disabled}
                  onClick={() => toggle(page)}
                  className={cx(pageButtonBase, active ? pageButtonActive : pageButtonIdle)}
                >
                  {page}
                  {active ? (
                    <Check
                      size={12}
                      className="absolute right-1 top-1 opacity-90"
                      aria-hidden
                    />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className={fade} aria-hidden />
        </div>

        <div className={ui.modalActions}>
          <button className={ui.button} type="button" onClick={onCancel}>
            <X size={16} aria-hidden />
            {t("common.cancel")}
          </button>
          <button
            className={cx(ui.button, ui.buttonPrimary)}
            type="button"
            onClick={confirm}
            disabled={chosen.length === 0}
            autoFocus
          >
            {callMode ? <Check size={16} aria-hidden /> : <Phone size={16} aria-hidden />}
            {callMode ? t("dialogs.pages.updatePages") : t("dialogs.pages.startLesson")}
          </button>
        </div>
      </div>
    </div>
  );
}
