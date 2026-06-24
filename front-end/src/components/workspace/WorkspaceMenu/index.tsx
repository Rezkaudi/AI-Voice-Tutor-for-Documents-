import { useRef, useState } from "react";
import {
  BookOpen,
  Captions,
  ChevronDown,
  Globe,
  Maximize2,
  Minimize2,
  RotateCcw,
  ScrollText,
  SlidersHorizontal
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "@/lib/uiClasses";
import { LANGUAGES } from "@/i18n/config";
import { useFullscreen } from "@/hooks/useFullscreen";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { MenuItem } from "./MenuItem";
import { StateChip } from "./StateChip";
import { LanguageSubmenu } from "./LanguageSubmenu";
import { useDismissable } from "@/hooks/useDismissable";

interface WorkspaceMenuProps {
  showTranscript: boolean;
  showCaption: boolean;
  restartDisabled: boolean;
  onEditPages?: () => void;
  onToggleTranscript: () => void;
  onToggleCaption: () => void;
  onRestart: () => void;
}

/**
 * Single overflow control for the document workspace. Collapses every
 * secondary action — Teaching pages, fullscreen, transcript, captions, and
 * restart — into one mobile-style dropdown so the document stays uncluttered.
 */
export function WorkspaceMenu({
  showTranscript,
  showCaption,
  restartDisabled,
  onEditPages,
  onToggleTranscript,
  onToggleCaption,
  onRestart
}: WorkspaceMenuProps) {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.resolvedLanguage ?? i18n.language;
  const currentLangLabel = LANGUAGES.find((l) => l.code === currentLang)?.label ?? currentLang;
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  useDismissable(open, rootRef, () => setOpen(false));

  const run = (action: () => void) => {
    action();
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="absolute end-4 top-4 z-30">
      {open ? (
        <div
          role="menu"
          aria-label={t("workspaceMenu.menuAria")}
          className="absolute end-0 top-12 w-60 origin-top rounded-xl border border-line bg-paper-strong p-1.5 shadow-app animate-modal-pop"
        >
          {onEditPages ? (
            <MenuItem icon={BookOpen} label={t("common.teachingPages")} onClick={() => run(onEditPages)} />
          ) : null}
          <MenuItem
            icon={isFullscreen ? Minimize2 : Maximize2}
            label={isFullscreen ? t("common.exitFullscreen") : t("common.fullscreen")}
            active={isFullscreen}
            onClick={() => run(toggleFullscreen)}
          />
          <MenuItem
            icon={ScrollText}
            label={t("common.transcript")}
            active={showTranscript}
            trailing={<StateChip on={showTranscript} />}
            onClick={() => run(onToggleTranscript)}
          />
          <MenuItem
            icon={Captions}
            label={t("workspaceMenu.captions")}
            active={showCaption}
            trailing={<StateChip on={showCaption} />}
            onClick={() => run(onToggleCaption)}
          />
          <div className="my-1 h-px bg-line" />
          <MenuItem
            icon={Globe}
            label={t("language.label")}
            active={langOpen}
            expanded={langOpen}
            onClick={() => setLangOpen((v) => !v)}
            trailing={
              <span className="flex items-center gap-1.5 text-[0.78rem] font-semibold text-muted">
                {!langOpen ? <span>{currentLangLabel}</span> : null}
                <ChevronDown
                  size={14}
                  aria-hidden
                  className={cx("transition-transform duration-200 ease-out", langOpen && "rotate-180")}
                />
              </span>
            }
          />
          {langOpen ? <LanguageSubmenu currentLang={currentLang} onSelect={run} /> : null}
          <div className="my-1 h-px bg-line" />
          <MenuItem
            icon={RotateCcw}
            label={t("common.restartLesson")}
            danger
            disabled={restartDisabled}
            onClick={() => {
              setOpen(false);
              setConfirmOpen(true);
            }}
          />
        </div>
      ) : null}

      <button
        type="button"
        className={cx(
          "inline-flex h-10 items-center gap-2 rounded-full px-4 text-[0.85rem] font-semibold tracking-[0.01em]",
          "shadow-[0_8px_22px_oklch(0.08_0.02_245/0.45)] backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)]",
          "transition-[transform,background,border-color] duration-200 ease-out",
          "[&:hover:not(:disabled)]:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.78_0.13_165)]",
          open
            ? "border border-transparent bg-[oklch(0.82_0.13_165)] text-[oklch(0.18_0.04_230)]"
            : "border border-[oklch(1_0_0/0.22)] bg-[oklch(0.17_0.025_244/0.78)] text-[oklch(0.97_0.01_215)] [&:hover:not(:disabled)]:border-[oklch(0.78_0.13_165/0.7)] [&:hover:not(:disabled)]:bg-[oklch(0.22_0.03_244/0.88)]"
        )}
        aria-label={t("workspaceMenu.lessonControlsMenu")}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t("workspaceMenu.lessonControls")}
        onClick={() => {
          setLangOpen(false);
          setOpen((value) => !value);
        }}
      >
        <SlidersHorizontal size={16} aria-hidden />
        <span>{t("workspaceMenu.menu")}</span>
      </button>

      <ConfirmDialog
        open={confirmOpen}
        title={t("dialogs.restart.title")}
        body={t("dialogs.restart.body")}
        confirmLabel={t("dialogs.restart.confirm")}
        cancelLabel={t("common.cancel")}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          onRestart();
        }}
      />
    </div>
  );
}
