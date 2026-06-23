import { useEffect, useState } from "react";
import {
  BookOpen,
  Captions,
  Check,
  ChevronDown,
  Globe,
  Maximize2,
  Minimize2,
  MoreVertical,
  RotateCcw,
  ScrollText,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "@/lib/uiClasses";
import { LANGUAGES } from "@/i18n/config";
import { useFullscreen } from "@/lib/useFullscreen";

interface MenuItemProps {
  icon?: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  trailing?: React.ReactNode;
}

/** One labelled row in the More menu. */
function MenuItem({
  icon: Icon,
  label,
  onClick,
  active = false,
  danger = false,
  disabled = false,
  expanded,
  trailing
}: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cx(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-[0.82rem] font-semibold transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[oklch(0.82_0.13_165)]",
        danger
          ? "text-[oklch(0.84_0.1_32)] [&:hover:not(:disabled)]:bg-[oklch(0.3_0.07_30/0.6)]"
          : "text-[oklch(0.95_0.01_215)] [&:hover:not(:disabled)]:bg-[oklch(0.26_0.03_240/0.7)]",
        active && !danger && "bg-[oklch(0.24_0.03_240/0.55)]"
      )}
      aria-pressed={expanded === undefined ? active : undefined}
      aria-expanded={expanded}
      onClick={onClick}
      disabled={disabled}
    >
      {Icon ? (
        <Icon size={16} aria-hidden className="flex-none" />
      ) : (
        <span className="w-4 flex-none" aria-hidden />
      )}
      <span className="flex-1">{label}</span>
      {trailing}
    </button>
  );
}

/** Small On/Off state chip shown on the captions row. */
function StateChip({ on }: { on: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      className={cx(
        "rounded-full px-1.5 py-0.5 text-[0.64rem] font-bold tracking-[0.02em]",
        on
          ? "bg-[oklch(0.82_0.13_165)] text-[oklch(0.18_0.04_230)]"
          : "bg-[oklch(0.3_0.025_240)] text-[oklch(0.78_0.02_215)]"
      )}
    >
      {on ? t("common.on") : t("common.off")}
    </span>
  );
}

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
  const { t, i18n } = useTranslation();
  const currentLang = i18n.resolvedLanguage ?? i18n.language;
  const currentLangLabel = LANGUAGES.find((l) => l.code === currentLang)?.label ?? currentLang;
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

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
      {/* Click-away catcher so a tap outside closes the menu. */}
      {open ? (
        <div className="fixed inset-0 z-30" aria-hidden onClick={() => setOpen(false)} />
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
                setOpen(false);
              }}
            />
            <MenuItem
              icon={isFullscreen ? Minimize2 : Maximize2}
              label={isFullscreen ? t("common.exitFullscreen") : t("common.fullscreen")}
              active={isFullscreen}
              onClick={() => {
                toggleFullscreen();
                setOpen(false);
              }}
            />
            <div className="mx-2 my-1 h-px bg-[oklch(1_0_0/0.1)]" aria-hidden />
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
                setOpen(false);
              }}
            />
            <div className="mx-2 my-1 h-px bg-[oklch(1_0_0/0.1)]" aria-hidden />
            <MenuItem
              icon={Globe}
              label={t("language.label")}
              active={langOpen}
              expanded={langOpen}
              onClick={() => setLangOpen((v) => !v)}
              trailing={
                <span className="flex items-center gap-1.5 text-[0.74rem] font-semibold text-[oklch(0.78_0.02_215)]">
                  {!langOpen ? <span>{currentLangLabel}</span> : null}
                  <ChevronDown
                    size={14}
                    aria-hidden
                    className={cx("transition-transform duration-200 ease-out", langOpen && "rotate-180")}
                  />
                </span>
              }
            />
            {langOpen ? (
              <div
                className="mb-0.5 ms-7 me-0.5 mt-0.5 flex origin-top flex-col gap-0.5 rounded-lg border border-[oklch(1_0_0/0.08)] bg-[oklch(0.2_0.025_242/0.6)] p-1 animate-submenu"
                role="group"
                aria-label={t("language.label")}
              >
                {LANGUAGES.map((lang) => {
                  const active = lang.code === currentLang;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      lang={lang.code}
                      dir="ltr"
                      className={cx(
                        "flex min-h-9 w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-start text-[0.82rem] font-semibold transition-colors duration-150 ease-out",
                        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[oklch(0.82_0.13_165)]",
                        active
                          ? "bg-[oklch(0.82_0.13_165)] text-[oklch(0.18_0.04_230)]"
                          : "text-[oklch(0.92_0.01_215)] [&:hover]:bg-[oklch(0.27_0.03_240/0.7)]"
                      )}
                      onClick={() => {
                        void i18n.changeLanguage(lang.code);
                        setOpen(false);
                      }}
                    >
                      <span>{lang.label}</span>
                      {active ? (
                        <Check size={15} className="flex-none text-[oklch(0.2_0.04_230)]" aria-hidden />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <div className="mx-2 my-1 h-px bg-[oklch(1_0_0/0.1)]" aria-hidden />
            <MenuItem
              icon={RotateCcw}
              label={t("common.restartLesson")}
              danger
              disabled={clearDisabled}
              onClick={() => {
                onClear();
                setOpen(false);
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
          onClick={() => {
            setLangOpen(false);
            setOpen((value) => !value);
          }}
        >
          {open ? <X size={20} aria-hidden /> : <MoreVertical size={20} aria-hidden />}
        </button>
      </div>
    </>
  );
}
