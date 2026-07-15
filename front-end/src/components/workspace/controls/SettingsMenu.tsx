import { useEffect, useState } from "react";
import {
  BookOpen,
  Captions,
  Maximize2,
  MessageCircleQuestion,
  Minimize2,
  RotateCcw,
  ScrollText,
  Settings2,
  X
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "@/lib/uiClasses";
import { useFullscreen } from "@/hooks/useFullscreen";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useChatStore } from "@/store/chatStore";
import { useSessionStore } from "@/store/sessionStore";
import {
  popover,
  popoverPosLarge,
  popoverPosSmall,
  triggerBase,
  triggerClosed,
  triggerOpen,
  wrapLarge,
  wrapSmall
} from "@/styles/components/workspace/controls/settingsMenu";
import { LanguageMenu } from "./LanguageMenu";
import { MenuDivider, MenuItem, StateChip } from "./MenuItem";

interface SettingsMenuProps {
  large?: boolean;
}

/** Settings popover: trigger button, dropdown of session options, and restart confirm. */
export function SettingsMenu({ large = false }: SettingsMenuProps) {
  const { t } = useTranslation();

  const wrapClass = large ? wrapLarge : wrapSmall;
  const popoverPos = large ? popoverPosLarge : popoverPosSmall;

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  const callMode = useSessionStore((s) => s.callMode);
  const openPageDialog = useSessionStore((s) => s.openPageDialog);
  const toggleCaption = useSessionStore((s) => s.toggleCaption);
  const toggleTranscript = useSessionStore((s) => s.toggleTranscript);
  const showCaption = useSessionStore((s) => s.showCaption);
  const showTranscript = useSessionStore((s) => s.showTranscript);
  const teacherAsks = useSessionStore((s) => s.teacherAsks);
  const toggleTeacherAsks = useSessionStore((s) => s.toggleTeacherAsks);
  const clearChat = useSessionStore((s) => s.clearChat);
  const hasMessages = useChatStore((s) => s.messages.length > 0);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const handleRestart = () => {
    setMenuOpen(false);
    if (!hasMessages && !callMode) clearChat();
    else setConfirmOpen(true);
  };

  return (
    <>
      {menuOpen ? (
        <div className="fixed inset-0 z-40" aria-hidden onClick={() => setMenuOpen(false)} />
      ) : null}

      <div className={wrapClass}>
        {menuOpen ? (
          <div
            className={cx(popover, popoverPos)}
            role="menu"
            aria-label={t("controls.settings.open")}
          >
            <MenuItem
              icon={BookOpen}
              label={t("common.teachingPages")}
              onClick={() => {
                setMenuOpen(false);
                openPageDialog();
              }}
            />
            <MenuItem
              icon={isFullscreen ? Minimize2 : Maximize2}
              label={isFullscreen ? t("common.exitFullscreen") : t("common.fullscreen")}
              active={isFullscreen}
              onClick={() => {
                toggleFullscreen();
                setMenuOpen(false);
              }}
            />
            <MenuDivider />
            <MenuItem
              icon={MessageCircleQuestion}
              label={t("controls.teacherAsks")}
              active={teacherAsks}
              disabled={callMode}
              onClick={toggleTeacherAsks}
              trailing={<StateChip on={teacherAsks} />}
            />
            <MenuItem
              icon={Captions}
              label={t("controls.liveCaptions")}
              active={showCaption}
              onClick={toggleCaption}
              trailing={<StateChip on={showCaption} />}
            />
            <MenuItem
              icon={ScrollText}
              label={t("common.transcript")}
              active={showTranscript}
              onClick={() => {
                setMenuOpen(false);
                toggleTranscript();
              }}
            />
            <MenuDivider />
            <LanguageMenu onSelect={() => setMenuOpen(false)} />
            <MenuDivider />
            <MenuItem
              icon={RotateCcw}
              label={t("common.restartLesson")}
              danger
              onClick={handleRestart}
            />
          </div>
        ) : null}

        <button
          type="button"
          className={cx(triggerBase, menuOpen ? triggerOpen : triggerClosed)}
          aria-label={menuOpen ? t("controls.settings.close") : t("controls.settings.open")}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X size={18} aria-hidden /> : <Settings2 size={18} aria-hidden />}
        </button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={t("dialogs.restart.title")}
        body={t("dialogs.restart.body")}
        confirmLabel={t("dialogs.restart.confirm")}
        cancelLabel={t("common.cancel")}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          clearChat();
        }}
      />
    </>
  );
}
