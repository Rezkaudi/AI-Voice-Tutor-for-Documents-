import { Loader2, Mic, MicOff, Pause, PhoneOff, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "@/lib/uiClasses";
import { useSessionStore } from "@/store/sessionStore";
import { useSpeechStore } from "@/store/speechStore";
import { useVoiceStore } from "@/store/voiceStore";

const circleBase =
  "relative grid place-items-center rounded-full border text-[oklch(0.95_0.012_100)] transition-[transform,background,border-color] duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-45 [&:active:not(:disabled)]:scale-[0.97] [&:hover:not(:disabled)]:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.82_0.09_200)]";
const circleIdle =
  "border-[oklch(1_0_0/0.14)] bg-[oklch(0.26_0.03_238)] [&:hover:not(:disabled)]:bg-[oklch(0.31_0.035_238)]";
const circleDanger =
  "border-[oklch(0.6_0.16_27/0.6)] bg-[oklch(0.4_0.12_27)] text-[oklch(0.95_0.04_27)] [&:hover:not(:disabled)]:bg-[oklch(0.46_0.14_27)]";
const circleActive =
  "animate-speak-pulse border-[oklch(0.7_0.13_154)] bg-[linear-gradient(140deg,oklch(0.66_0.14_154),oklch(0.5_0.13_162))] text-[oklch(0.99_0.008_138)]";
const circlePaused =
  "border-[oklch(0.78_0.13_75/0.6)] bg-[oklch(0.45_0.1_75)] text-[oklch(0.97_0.04_75)] [&:hover:not(:disabled)]:bg-[oklch(0.5_0.11_75)]";

interface CallControlsProps {
  large?: boolean;
}

export function CallControls({ large = false }: CallControlsProps) {
  const { t } = useTranslation();

  const circleSize = large ? "h-[3.25rem] w-[3.25rem]" : "h-9 w-9";
  const iconSize = large ? 24 : 17;
  const barChrome = large ? "gap-2.5 p-2" : "gap-1.5 p-1";
  const endBtnSize = large ? "h-[3.25rem] gap-2 px-6 text-[0.95rem]" : "h-9 w-9";
  const endIconSize = large ? 20 : 15;

  const handleCallToggle = useSessionStore((s) => s.handleCallToggle);

  const permission = useVoiceStore((s) => s.permission);
  const micMuted = useVoiceStore((s) => s.micMuted);
  const isUserSpeaking = useVoiceStore((s) => s.isUserSpeaking);
  const isTranscribing = useVoiceStore((s) => s.isTranscribing);
  const toggleMicMuted = useVoiceStore((s) => s.toggleMicMuted);
  const setMicMuted = useVoiceStore((s) => s.setMicMuted);

  const agentPaused = useSpeechStore((s) => s.agentPaused);
  const toggleAgentPaused = useSpeechStore((s) => s.toggleAgentPaused);

  const micBlocked = permission === "denied";

  const handlePauseToggle = () => {
    const nextPaused = !agentPaused;
    toggleAgentPaused();
    setMicMuted(nextPaused);
  };

  return (
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
        className={cx(circleSize, circleBase, agentPaused ? circlePaused : circleIdle)}
        aria-label={agentPaused ? t("controls.voice.resumeAria") : t("controls.voice.pauseAria")}
        aria-pressed={agentPaused}
        title={agentPaused ? t("controls.voice.resumeAria") : t("controls.voice.pauseAria")}
        onClick={handlePauseToggle}
      >
        {agentPaused ? <Play size={iconSize} aria-hidden /> : <Pause size={iconSize} aria-hidden />}
      </button>

      <button
        type="button"
        className={cx(
          "animate-listen-pulse-slow inline-flex items-center justify-center rounded-full border-0 bg-[linear-gradient(to_bottom,oklch(0.53_0.045_27),oklch(0.6_0.24_27))] bg-size-[100%_200%] bg-position-[50%_0%] font-bold text-[oklch(0.99_0.005_100)] shadow-[0_10px_24px_oklch(0.18_0.04_27/0.5)] transition-[transform,filter,background-position] duration-320 ease-out [&:active:not(:disabled)]:scale-[0.98] [&:hover:not(:disabled)]:-translate-y-px [&:hover:not(:disabled)]:brightness-105 [&:hover:not(:disabled)]:bg-position-[50%_100%] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[oklch(0.82_0.09_200)]",
          endBtnSize
        )}
        aria-label={t("controls.session.endAria")}
        onClick={handleCallToggle}
      >
        <PhoneOff size={endIconSize} aria-hidden />
        {large ? <span>{t("controls.session.end")}</span> : null}
      </button>
    </div>
  );
}
