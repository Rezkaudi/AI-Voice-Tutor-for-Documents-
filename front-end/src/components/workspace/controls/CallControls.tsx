import { Loader2, Mic, MicOff, Pause, PhoneOff, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "@/lib/uiClasses";
import { useSessionStore } from "@/store/sessionStore";
import { useSpeechStore } from "@/store/speechStore";
import { useVoiceStore } from "@/store/voiceStore";
import {
  callBar,
  circleActive,
  circleBase,
  circleDanger,
  circleIdle,
  circlePaused,
  endButton
} from "@/styles/components/workspace/controls/callControls";

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
      className={cx(callBar, barChrome)}
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
        className={cx(endButton, endBtnSize)}
        aria-label={t("controls.session.endAria")}
        onClick={handleCallToggle}
      >
        <PhoneOff size={endIconSize} aria-hidden />
        {large ? <span>{t("controls.session.end")}</span> : null}
      </button>
    </div>
  );
}
