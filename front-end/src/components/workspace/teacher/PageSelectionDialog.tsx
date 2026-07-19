import { AlertTriangle, BookOpen, Check, Loader2, Phone, X } from "lucide-react";
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
  pageButtonExtracting,
  pageButtonFailed,
  pageButtonIdle,
  pageButtonPending,
  readyFill,
  readyRow,
  readyTrack
} from "@/styles/components/workspace/teacher/pageSelectionDialog";
import type { ExtractionState } from "@/types";

interface PageSelectionDialogProps {

  pageCount: number;

  selectedPages: number[];

  callMode: boolean;
  extraction?: ExtractionState;
  onConfirm: (pages: number[]) => void;
  onCancel: () => void;
}

type PageStatus = "ready" | "extracting" | "pending" | "failed";

function normalize(pages: number[], pageCount: number): number[] {
  return Array.from(new Set(pages))
    .filter((page) => page >= 1 && page <= pageCount)
    .sort((a, b) => a - b)
    .slice(0, MAX_LESSON_PAGES);
}

function pageStatus(
  page: number,
  extraction: ExtractionState | undefined,
  loadingPage: number | null
): PageStatus {
  if (!extraction) return "ready";
  if (extraction.extractedPages.includes(page)) return "ready";
  if (extraction.failedPages.includes(page)) return "failed";
  if (extraction.done) return "failed";
  if (loadingPage === page) return "extracting";
  return "pending";
}

function loadingPageFor(
  extraction: ExtractionState | undefined,
  pageCount: number
): number | null {
  if (!extraction || extraction.done) return null;

  const ready = new Set(extraction.extractedPages);
  const failed = new Set(extraction.failedPages);
  if (
    extraction.currentPage !== null &&
    extraction.currentPage >= 1 &&
    extraction.currentPage <= pageCount &&
    !ready.has(extraction.currentPage) &&
    !failed.has(extraction.currentPage)
  ) {
    return extraction.currentPage;
  }

  for (let page = 1; page <= pageCount; page += 1) {
    if (!ready.has(page) && !failed.has(page)) return page;
  }
  return null;
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

  const loadingPage = loadingPageFor(extraction, pageCount);

  // Only successfully extracted pages may stay selected while extraction runs.
  const selected = chosen.filter(
    (page) => pageStatus(page, extraction, loadingPage) === "ready"
  );

  const atLimit = selected.length >= MAX_LESSON_PAGES;
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
  const showProgress = extraction !== undefined && !extraction.done;
  const readyCount = extraction
    ? extraction.extractedPages.length
    : pageCount;

  const toggle = (page: number) => {
    setChosen(() => {
      if (selected.includes(page)) return selected.filter((p) => p !== page);
      if (selected.length >= MAX_LESSON_PAGES) return selected;
      return [...selected, page].sort((a, b) => a - b);
    });
  };

  const confirm = () => onConfirm(selected.length > 0 ? selected : [1]);

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
          <div className={readyRow} aria-live="polite">
            <span className="shrink-0">
              {t("dialogs.pages.ready", { ready: readyCount, total: pageCount })}
            </span>
            <div className={readyTrack} aria-hidden>
              <div
                className={readyFill}
                style={{ width: `${pageCount > 0 ? (readyCount / pageCount) * 100 : 0}%` }}
              />
            </div>
          </div>
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
              const status = pageStatus(page, extraction, loadingPage);
              const active = selected.includes(page);
              const disabled = status !== "ready" || (!active && atLimit);
              const title =
                status === "extracting"
                  ? t("dialogs.pages.pageExtracting", { page })
                  : status === "pending"
                    ? t("dialogs.pages.pagePending")
                    : status === "failed"
                      ? t("dialogs.pages.pageFailed")
                      : !active && atLimit
                        ? t("dialogs.pages.pageAtMost", { max: MAX_LESSON_PAGES })
                        : t("dialogs.pages.pageLabel", { page });
              return (
                <button
                  key={page}
                  type="button"
                  aria-pressed={active}
                  aria-label={t("dialogs.pages.pageLabel", { page })}
                  title={title}
                  disabled={disabled}
                  onClick={() => toggle(page)}
                  className={cx(
                    pageButtonBase,
                    active
                      ? pageButtonActive
                      : status === "extracting"
                        ? pageButtonExtracting
                        : status === "pending"
                          ? pageButtonPending
                          : status === "failed"
                            ? pageButtonFailed
                            : pageButtonIdle
                  )}
                >
                  {status === "extracting" ? (
                    <Loader2 size={14} className="animate-spin" aria-hidden />
                  ) : (
                    page
                  )}
                  {active ? (
                    <Check
                      size={12}
                      className="absolute right-1 top-1 opacity-90"
                      aria-hidden
                    />
                  ) : null}
                  {status === "failed" ? (
                    <AlertTriangle
                      size={11}
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
