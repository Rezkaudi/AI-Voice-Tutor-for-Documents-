import { useEffect, useState } from "react";
import {
  BookOpen,
  Captions,
  Maximize2,
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
import { LanguageMenu } from "./LanguageMenu";
import { MenuDivider, MenuItem, StateChip } from "./MenuItem";

interface SettingsMenuProps {
  large?: boolean;
}

/** Settings popover: trigger button, dropdown of session options, and restart confirm. */
export function SettingsMenu({ large = false }: SettingsMenuProps) {
  const { t } = useTranslation();

  const wrapClass = large
    ? "pointer-events-auto absolute end-4 top-4 z-50"
    : "pointer-events-auto fixed bottom-[calc(env(safe-area-inset-bottom)+12px)] end-3 z-50";
  const popoverPos = large
    ? "top-[calc(100%+10px)] end-0 origin-top-right"
    : "bottom-[calc(100%+10px)] end-0 origin-bottom-right";

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  const callMode = useSessionStore((s) => s.callMode);
  const openPageDialog = useSessionStore((s) => s.openPageDialog);
  const toggleCaption = useSessionStore((s) => s.toggleCaption);
  const toggleTranscript = useSessionStore((s) => s.toggleTranscript);
  const showCaption = useSessionStore((s) => s.showCaption);
  const showTranscript = useSessionStore((s) => s.showTranscript);
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
            className={cx(
              "absolute z-50 w-[212px] animate-modal-pop rounded-xl border border-[oklch(1_0_0/0.12)] bg-[oklch(0.16_0.022_244/0.96)] p-1 shadow-[0_24px_60px_oklch(0.05_0.02_244/0.6)] backdrop-blur-[16px]",
              popoverPos
            )}
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
          className={cx(
            "grid h-10 w-10 place-items-center rounded-full border shadow-[0_10px_26px_oklch(0.05_0.02_244/0.5)] backdrop-blur-[12px] transition-[transform,background,border-color] duration-150 ease-out [&:hover:not(:disabled)]:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.82_0.13_165)]",
            menuOpen
              ? "border-transparent bg-[oklch(0.82_0.13_165)] text-[oklch(0.18_0.04_230)]"
              : "border-[oklch(1_0_0/0.12)] bg-[oklch(0.15_0.022_244/0.86)] text-[oklch(0.95_0.01_215)]"
          )}
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
