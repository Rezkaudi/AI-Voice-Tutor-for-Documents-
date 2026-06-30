import { useEffect, useState } from "react";
import {
  BookOpen,
  Captions,
  Loader2,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Phone,
  PhoneOff,
  RotateCcw,
  ScrollText,
  Settings2,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "@/lib/uiClasses";
import { useFullscreen } from "@/hooks/useFullscreen";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useChatStore } from "@/store/chatStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSpeechStore } from "@/store/speechStore";
import { useVoiceStore } from "@/store/voiceStore";
import { LanguageMenu } from "./LanguageMenu";
import { MenuDivider, MenuItem, StateChip } from "./MenuItem";

const circleBase =
  "relative grid place-items-center rounded-full border text-[oklch(0.95_0.012_100)] transition-[transform,background,border-color] duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-45 [&:active:not(:disabled)]:scale-[0.97] [&:hover:not(:disabled)]:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.82_0.09_200)]";
const circleIdle =
  "border-[oklch(1_0_0/0.14)] bg-[oklch(0.26_0.03_238)] [&:hover:not(:disabled)]:bg-[oklch(0.31_0.035_238)]";
const circleDanger =
  "border-[oklch(0.6_0.16_27/0.6)] bg-[oklch(0.4_0.12_27)] text-[oklch(0.95_0.04_27)] [&:hover:not(:disabled)]:bg-[oklch(0.46_0.14_27)]";
const circleActive =
  "animate-speak-pulse border-[oklch(0.7_0.13_154)] bg-[linear-gradient(140deg,oklch(0.66_0.14_154),oklch(0.5_0.13_162))] text-[oklch(0.99_0.008_138)]";

interface SessionControlBarProps {
  large?: boolean;
  showMenu?: boolean;
}

export function SessionControlBar({ large = false, showMenu = true }: SessionControlBarProps) {
  const { t } = useTranslation();

  const circleSize = large ? "h-[3.25rem] w-[3.25rem]" : "h-9 w-9";
  const iconSize = large ? 24 : 17;
  const barChrome = large ? "gap-2.5 p-2" : "gap-1.5 p-1";
  const endBtnSize = large
    ? "h-[3.25rem] gap-2 px-6 text-[0.95rem]"
    : "h-9 gap-1.5 px-3.5 text-[0.8rem]";
  const endIconSize = large ? 20 : 15;
  const startBtnSize = large
    ? "h-[3.5rem] gap-2.5 px-9 text-[1.05rem]"
    : "h-12 gap-2.5 px-7 text-[0.95rem]";
  const startIconSize = large ? 21 : 18;

  const menuWrapClass = large
    ? "pointer-events-auto absolute end-4 top-4 z-50"
    : "pointer-events-auto fixed bottom-[calc(env(safe-area-inset-bottom)+12px)] end-3 z-50";
  const menuPopoverPos = large
    ? "top-[calc(100%+10px)] end-0 origin-top-right"
    : "bottom-[calc(100%+10px)] end-0 origin-bottom-right";
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  const callMode = useSessionStore((s) => s.callMode);
  const handleCallToggle = useSessionStore((s) => s.handleCallToggle);
  const openPageDialog = useSessionStore((s) => s.openPageDialog);
  const toggleCaption = useSessionStore((s) => s.toggleCaption);
  const toggleTranscript = useSessionStore((s) => s.toggleTranscript);
  const showCaption = useSessionStore((s) => s.showCaption);
  const showTranscript = useSessionStore((s) => s.showTranscript);
  const clearChat = useSessionStore((s) => s.clearChat);

  const isSupported = useVoiceStore((s) => s.isSupported);
  const permission = useVoiceStore((s) => s.permission);
  const micMuted = useVoiceStore((s) => s.micMuted);
  const isUserSpeaking = useVoiceStore((s) => s.isUserSpeaking);
  const isTranscribing = useVoiceStore((s) => s.isTranscribing);
  const toggleMicMuted = useVoiceStore((s) => s.toggleMicMuted);

  const agentMuted = useSpeechStore((s) => s.agentMuted);
  const toggleAgentMuted = useSpeechStore((s) => s.toggleAgentMuted);

  const hasMessages = useChatStore((s) => s.messages.length > 0);

  const micBlocked = permission === "denied";

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
      {showMenu && menuOpen ? (
        <div className="fixed inset-0 z-40" aria-hidden onClick={() => setMenuOpen(false)} />
      ) : null}

      {showMenu ? (
        <div className={menuWrapClass}>
          {menuOpen ? (
            <div
              className={cx(
                "absolute z-50 w-[212px] animate-modal-pop rounded-xl border border-[oklch(1_0_0/0.12)] bg-[oklch(0.16_0.022_244/0.96)] p-1 shadow-[0_24px_60px_oklch(0.05_0.02_244/0.6)] backdrop-blur-[16px]",
                menuPopoverPos
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
      ) : null}

      {!callMode ? (
        <div className="pointer-events-auto relative grid place-items-center">
          {isSupported && !micBlocked ? (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full bg-[oklch(0.62_0.14_154)] blur-[3px] animate-halo-pulse motion-reduce:hidden"
            />
          ) : null}
          <button
            type="button"
            className={cx(
              "relative inline-flex items-center justify-center rounded-full bg-[linear-gradient(140deg,oklch(0.68_0.15_154),oklch(0.5_0.13_162))] font-bold tracking-[0.01em] text-[oklch(0.99_0.005_100)] ring-1 ring-inset ring-[oklch(1_0_0/0.18)] shadow-[0_14px_34px_oklch(0.45_0.1_154/0.45),inset_0_1px_0_oklch(1_0_0/0.25)] transition-[transform,filter] duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none [&:active:not(:disabled)]:scale-[0.97] [&:hover:not(:disabled)]:-translate-y-px [&:hover:not(:disabled)]:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[oklch(0.82_0.09_200)]",
              startBtnSize
            )}
            aria-label={t("controls.session.startAria")}
            onClick={handleCallToggle}
            disabled={!isSupported || micBlocked}
          >
            <Phone size={startIconSize} aria-hidden />
            <span>{t("controls.session.start")}</span>
          </button>
        </div>
      ) : (
        <div
          className={cx(
            "pointer-events-auto relative z-40 flex items-center rounded-full border border-[oklch(1_0_0/0.12)] bg-[oklch(0.14_0.022_244/0.9)] shadow-[0_18px_48px_oklch(0.05_0.02_244/0.55)] backdrop-blur-[14px]",
            barChrome
          )}
          role="group"
          aria-label={t("controls.callControls")}
        >
          <button
            type="button"
            className={cx(
              circleSize,
              circleBase,
              micMuted ? circleDanger : isUserSpeaking ? circleActive : circleIdle
            )}
            aria-label={micMuted ? t("controls.micMute.unmuteAria") : t("controls.micMute.muteAria")}
            aria-pressed={micMuted}
            title={micMuted ? t("controls.micMute.off") : t("controls.micMute.on")}
            onClick={toggleMicMuted}
            disabled={micBlocked}
          >
            {isTranscribing ? (
              <Loader2 className="animate-spin-fast" size={iconSize} aria-hidden />
            ) : micMuted ? (
              <MicOff size={iconSize} aria-hidden />
            ) : (
              <Mic size={iconSize} aria-hidden />
            )}
          </button>

          <button
            type="button"
            className={cx(circleSize, circleBase, agentMuted ? circleDanger : circleIdle)}
            aria-label={agentMuted ? t("controls.voice.unmuteAria") : t("controls.voice.muteAria")}
            aria-pressed={agentMuted}
            title={agentMuted ? t("controls.voice.unmuteAria") : t("controls.voice.muteAria")}
            onClick={toggleAgentMuted}
          >
            {agentMuted ? (
              <VolumeX size={iconSize} aria-hidden />
            ) : (
              <Volume2 size={iconSize} aria-hidden />
            )}
          </button>

          <button
            type="button"
            className={cx(
              "inline-flex items-center rounded-full border-0 bg-[linear-gradient(to_bottom,oklch(0.53_0.045_27),oklch(0.6_0.24_27))] font-bold text-[oklch(0.99_0.005_100)] shadow-[0_10px_24px_oklch(0.18_0.04_27/0.5)] transition-[transform,filter] duration-150 ease-out [&:active:not(:disabled)]:scale-[0.98] [&:hover:not(:disabled)]:-translate-y-px [&:hover:not(:disabled)]:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[oklch(0.82_0.09_200)]",
              endBtnSize
            )}
            aria-label={t("controls.session.endAria")}
            onClick={handleCallToggle}
          >
            <PhoneOff size={endIconSize} aria-hidden />
            <span>{t("controls.session.end")}</span>
          </button>
        </div>
      )}

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
