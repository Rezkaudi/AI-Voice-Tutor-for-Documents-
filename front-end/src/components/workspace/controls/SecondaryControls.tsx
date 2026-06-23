import { useEffect, useState } from "react";
import {
  BookOpen,
  Captions,
  Maximize2,
  Minimize2,
  MoreVertical,
  RotateCcw,
  ScrollText,
  X
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "@/lib/uiClasses";
import { useFullscreen } from "@/hooks/useFullscreen";
import { MenuDivider, MenuItem, StateChip } from "./MenuItem";
import { LanguageMenu } from "./LanguageMenu";

interface SecondaryControlsProps {
  showCaption: boolean;
  showTranscript: boolean;
  clearDisabled: boolean;
  onEditPages: () => void;
  onToggleCaption: () => void;
  onToggleTranscript: () => void;
  onClear: () => void;
}

export function SecondaryControls({
  showCaption,
  showTranscript,
  clearDisabled,
  onEditPages,
  onToggleCaption,
  onToggleTranscript,
  onClear
}: SecondaryControlsProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-30" aria-hidden onClick={close} />
      ) : null}

      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+12px)] end-3 z-40 flex flex-col items-end gap-2">
        {open ? (
          <div
            className="mb-1 w-[204px] origin-bottom-right animate-modal-pop rounded-xl border border-[oklch(1_0_0/0.12)] bg-[oklch(0.16_0.022_244/0.95)] p-1 shadow-[0_24px_60px_oklch(0.05_0.02_244/0.6)] backdrop-blur-[16px]"
            role="menu"
            aria-label={t("controls.more.menuAria")}
          >
            <MenuItem
              icon={BookOpen}
              label={t("common.teachingPages")}
              onClick={() => {
                onEditPages();
                close();
              }}
            />
            <MenuItem
              icon={isFullscreen ? Minimize2 : Maximize2}
              label={isFullscreen ? t("common.exitFullscreen") : t("common.fullscreen")}
              active={isFullscreen}
              onClick={() => {
                toggleFullscreen();
                close();
              }}
            />
            <MenuDivider />
            <MenuItem
              icon={Captions}
              label={t("controls.liveCaptions")}
              active={showCaption}
              onClick={onToggleCaption}
              trailing={<StateChip on={showCaption} />}
            />
            <MenuItem
              icon={ScrollText}
              label={t("common.transcript")}
              active={showTranscript}
              onClick={() => {
                onToggleTranscript();
                close();
              }}
            />
            <MenuDivider />
            <LanguageMenu onSelect={close} />
            <MenuDivider />
            <MenuItem
              icon={RotateCcw}
              label={t("common.restartLesson")}
              danger
              disabled={clearDisabled}
              onClick={() => {
                onClear();
                close();
              }}
            />
          </div>
        ) : null}

        <button
          type="button"
          className={cx(
            "grid h-13 w-13 place-items-center rounded-full border shadow-[0_12px_30px_oklch(0.05_0.02_244/0.55)] backdrop-blur-[12px] transition-[transform,background,border-color] duration-200 ease-out [&:hover:not(:disabled)]:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.82_0.13_165)]",
            open
              ? "border-transparent bg-[oklch(0.82_0.13_165)] text-[oklch(0.18_0.04_230)]"
              : "border-[oklch(1_0_0/0.12)] bg-[oklch(0.15_0.022_244/0.86)] text-[oklch(0.95_0.01_215)]"
          )}
          aria-label={open ? t("controls.more.hide") : t("controls.more.show")}
          aria-expanded={open}
          aria-haspopup="menu"
          title={open ? t("controls.more.hideTitle") : t("controls.more.title")}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={20} aria-hidden /> : <MoreVertical size={20} aria-hidden />}
        </button>
      </div>
    </>
  );
}
