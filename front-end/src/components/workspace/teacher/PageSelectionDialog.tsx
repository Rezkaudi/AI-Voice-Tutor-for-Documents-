import { BookOpen, Check, Phone, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { MAX_LESSON_PAGES } from "@/lib/constants";
import { cx, ui } from "@/lib/uiClasses";

interface PageSelectionDialogProps {
  /** Total pages in the loaded document. */
  pageCount: number;
  /** Pages currently chosen, so the picker opens on the last selection. */
  selectedPages: number[];
  /** True while a call is already running — changes the confirm wording. */
  callMode: boolean;
  onConfirm: (pages: number[]) => void;
  onCancel: () => void;
}

/** Clamps and orders a raw selection: in-range, unique, sorted, capped. */
function normalize(pages: number[], pageCount: number): number[] {
  return Array.from(new Set(pages))
    .filter((page) => page >= 1 && page <= pageCount)
    .sort((a, b) => a - b)
    .slice(0, MAX_LESSON_PAGES);
}

/**
 * The lesson-pages picker shown when the learner starts (or edits) a call.
 * They tap up to {@link MAX_LESSON_PAGES} pages; the tutor teaches exactly
 * those, in order, page by page. The parent mounts this only while open, so
 * the initial selection is seeded once on mount.
 */
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
          <div
            className={cx(
              ui.modalIcon,
              "h-8! w-8! border-[oklch(0.82_0.07_165)]! bg-[oklch(0.95_0.04_165)]! text-[oklch(0.45_0.13_165)]!"
            )}
            aria-hidden
          >
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

        <div
          className="flex items-center justify-between text-[0.78rem] font-semibold text-[oklch(0.42_0.02_244)]"
          aria-live="polite"
        >
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
          <div className="grid max-h-[42vh] grid-cols-[repeat(auto-fill,minmax(42px,1fr))] gap-1.5 overflow-y-auto overscroll-contain rounded-xl border border-line bg-paper p-2.5 pr-2 [scrollbar-color:oklch(0.7_0.03_86)_transparent] scrollbar-thin [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[oklch(0.7_0.03_86/0.6)] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5">
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
                  className={cx(
                    "relative grid aspect-square min-h-[38px] place-items-center rounded-lg border text-[0.8rem] font-bold transition-[transform,background,border-color,box-shadow] duration-140 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40",
                    active
                      ? "border-transparent bg-accent text-[oklch(0.98_0.01_138)] shadow-app"
                      : "border-line bg-paper-strong text-ink [&:hover:not(:disabled)]:-translate-y-px [&:hover:not(:disabled)]:border-accent [&:hover:not(:disabled)]:shadow-app"
                  )}
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
          {/* Soft fade hints there are more pages to scroll to. */}
          <div
            className="pointer-events-none absolute inset-x-2 bottom-px h-7 rounded-b-xl bg-linear-to-t from-paper to-transparent"
            aria-hidden
          />
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
