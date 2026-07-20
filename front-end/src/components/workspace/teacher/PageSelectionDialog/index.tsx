import { BookOpen, Check, Phone, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { MAX_LESSON_PAGES } from "@/lib/constants";
import { normalizePageSelection, pageStatus } from "@/lib/pageSelection";
import { cx, ui } from "@/lib/uiClasses";
import { counter, fade, grid, iconOverride } from "@/styles/components/workspace/teacher/pageSelectionDialog";
import type { ExtractionState } from "@/types";
import { ExtractionProgressRow } from "./ExtractionProgressRow";
import { PageButton } from "./PageButton";

interface PageSelectionDialogProps {
  pageCount: number;
  selectedPages: number[];
  callMode: boolean;
  extraction?: ExtractionState;
  onConfirm: (pages: number[]) => void;
  onCancel: () => void;
}

export function PageSelectionDialog({
  pageCount,
  selectedPages,
  callMode,
  extraction,
  onConfirm,
  onCancel
}: PageSelectionDialogProps) {

  const { t } = useTranslation();
  const [chosen, setChosen] = useState<number[]>(() => normalizePageSelection(selectedPages, pageCount));

  useEscapeKey(onCancel);

  const selected = chosen.filter((page) => pageStatus(page, extraction) === "ready");

  const atLimit = selected.length >= MAX_LESSON_PAGES;
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
  const showProgress = extraction !== undefined && !extraction.done;
  const readyCount = extraction ? extraction.extractedPages.length : pageCount;

  const toggle = (page: number) => {
    setChosen(() => {
      if (selected.includes(page)) return selected.filter((p) => p !== page);
      if (selected.length >= MAX_LESSON_PAGES) return selected;
      return [...selected, page].sort((a, b) => a - b);
    });
  };

  const confirm = () => onConfirm(selected.length > 0 ? selected : [1]);

  const titleFor = (page: number, status: ReturnType<typeof pageStatus>, active: boolean) => {
    if (status === "extracting") return t("dialogs.pages.pageExtracting", { page });
    if (status === "pending") return t("dialogs.pages.pagePending");
    if (status === "failed") return t("dialogs.pages.pageFailed");
    if (!active && atLimit) return t("dialogs.pages.pageAtMost", { max: MAX_LESSON_PAGES });
    return t("dialogs.pages.pageLabel", { page });
  };

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

        {showProgress ? (
          <ExtractionProgressRow readyCount={readyCount} pageCount={pageCount} />
        ) : null}

        <div className={counter} aria-live="polite">
          <span>
            {t("dialogs.pages.selected", { count: selected.length, max: MAX_LESSON_PAGES })}
          </span>
          {selected.length > 0 ? (
            <span className="font-medium text-muted">
              {t("dialogs.pages.teaching", { pages: selected.join(", ") })}
            </span>
          ) : null}
        </div>

        <div className="relative -mx-1">
          <div className={grid}>
            {pages.map((page) => {
              const status = pageStatus(page, extraction);
              const active = selected.includes(page);
              return (
                <PageButton
                  key={page}
                  page={page}
                  status={status}
                  active={active}
                  disabled={status !== "ready" || (!active && atLimit)}
                  label={t("dialogs.pages.pageLabel", { page })}
                  title={titleFor(page, status, active)}
                  onToggle={toggle}
                />
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
            disabled={selected.length === 0}
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
