import { useRef, useState } from "react";
import {
  BookOpen,
  Captions,
  ChevronDown,
  Globe,
  Maximize2,
  MessageCircleQuestion,
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
import {
  chevron,
  divider,
  langTrailing,
  popover,
  triggerBase,
  triggerClosed,
  triggerOpen
} from "@/styles/components/workspace/workspaceMenu";
import { MenuItem } from "./MenuItem";
import { StateChip } from "./StateChip";
import { LanguageSubmenu } from "./LanguageSubmenu";
import { useDismissable } from "@/hooks/useDismissable";

interface WorkspaceMenuProps {
  showTranscript: boolean;
  showCaption: boolean;
  teacherAsks: boolean;
  teacherAsksDisabled: boolean;
  restartDisabled: boolean;
  onEditPages?: () => void;
  onToggleTranscript: () => void;
  onToggleCaption: () => void;
  onToggleTeacherAsks: () => void;
  onRestart: () => void;
}

export function WorkspaceMenu({
  showTranscript,
  showCaption,
  teacherAsks,
  teacherAsksDisabled,
  restartDisabled,
  onEditPages,
  onToggleTranscript,
  onToggleCaption,
  onToggleTeacherAsks,
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
          className={popover}
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
          <MenuItem
            icon={MessageCircleQuestion}
            label={t("controls.teacherAsks")}
            active={teacherAsks}
            disabled={teacherAsksDisabled}
            trailing={<StateChip on={teacherAsks} />}
            onClick={() => run(onToggleTeacherAsks)}
          />
          <div className={divider} />
          <MenuItem
            icon={Globe}
            label={t("language.label")}
            active={langOpen}
            expanded={langOpen}
            onClick={() => setLangOpen((v) => !v)}
            trailing={
              <span className={langTrailing}>
                {!langOpen ? <span>{currentLangLabel}</span> : null}
                <ChevronDown
                  size={14}
                  aria-hidden
                  className={cx(chevron, langOpen && "rotate-180")}
                />
              </span>
            }
          />
          {langOpen ? <LanguageSubmenu currentLang={currentLang} onSelect={run} /> : null}
          <div className={divider} />
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
        className={cx(triggerBase, open ? triggerOpen : triggerClosed)}
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
