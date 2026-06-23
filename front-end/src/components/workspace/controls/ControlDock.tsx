import { Loader2, Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "@/lib/uiClasses";
import { deriveDockStatus } from "@/components/workspace/teacher/TeacherPanel/status";
import { ThinkingDots, VoiceWave } from "./StatusIndicators";

interface ControlDockProps {
  callMode: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isStreaming: boolean;
  isTranscribing: boolean;
  micSupported: boolean;
  micBlocked: boolean;
  onCallToggle: () => void | Promise<void>;
  onMicClick: () => void;
}

export function ControlDock({
  callMode,
  isListening,
  isSpeaking,
  isStreaming,
  isTranscribing,
  micSupported,
  micBlocked,
  onCallToggle,
  onMicClick
}: ControlDockProps) {
  const { t } = useTranslation();
  const dock = deriveDockStatus({ isSpeaking, isListening, isStreaming, isTranscribing, callMode });


  const isThinking = callMode && dock.tone === "thinking";
  const canInterrupt = dock.interruptible;

  const micLabel = isTranscribing
    ? t("controls.mic.sending")
    : isListening
      ? t("controls.mic.mute")
      : isThinking
        ? t("controls.mic.thinking")
        : canInterrupt
          ? t("controls.mic.interrupt")
          : t("controls.mic.speak");
  const micAria = isListening
    ? t("controls.mic.muteAria")
    : isThinking
      ? t("controls.mic.thinkingAria")
      : canInterrupt
        ? t("controls.mic.interruptAria")
        : t("controls.mic.speakAria");

  const micDisabled = !callMode || isTranscribing || micBlocked || isThinking;

  return (
    <div
      className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-[oklch(1_0_0/0.12)] bg-[oklch(0.15_0.022_244/0.86)] p-1.5 shadow-[0_18px_48px_oklch(0.05_0.02_244/0.55)] backdrop-blur-[14px]"
      role="group"
      aria-label={t("controls.callControls")}
    >
      <button
        type="button"
        className={cx(
          "inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-[0.82rem] font-semibold text-[oklch(0.95_0.012_100)] transition-[transform,background,border-color] duration-150 ease-out disabled:cursor-not-allowed [&:active:not(:disabled)]:scale-[0.98] [&:hover:not(:disabled)]:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.82_0.09_200)]",
          isListening
            ? "animate-speak-pulse border-[oklch(0.7_0.13_154)] bg-[linear-gradient(140deg,oklch(0.66_0.14_154),oklch(0.5_0.13_162))]"
            : isThinking
              ? "border-[oklch(0.46_0.07_230)] bg-[oklch(0.26_0.04_232)] opacity-90 disabled:opacity-90"
              : "border-[oklch(0.46_0.04_230)] bg-[oklch(0.3_0.035_232)] disabled:opacity-45 [&:hover:not(:disabled)]:bg-[oklch(0.36_0.04_232)]"
        )}
        aria-label={micAria}
        aria-pressed={isListening}
        onClick={onMicClick}
        disabled={micDisabled}
      >
        {isTranscribing ? (
          <Loader2 className="animate-spin-fast" size={17} aria-hidden />
        ) : isListening ? (
          <VoiceWave />
        ) : isThinking ? (
          <ThinkingDots />
        ) : canInterrupt ? (
          <Mic size={17} aria-hidden />
        ) : (
          <MicOff size={17} aria-hidden />
        )}
        <span>{micLabel}</span>
      </button>

      <button
        type="button"
        className={cx(
          "inline-flex h-10 items-center gap-2 rounded-full border-0 px-4 text-[0.88rem] font-bold text-[oklch(0.99_0.005_100)] shadow-[0_10px_24px_oklch(0.18_0.04_244/0.5)] transition-[transform,box-shadow,filter,background-position] duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50 [&:active:not(:disabled)]:scale-[0.98] [&:hover:not(:disabled)]:-translate-y-px [&:hover:not(:disabled)]:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[oklch(0.82_0.09_200)]",
          callMode
            ? "animate-listen-pulse-slow bg-[linear-gradient(to_bottom,oklch(0.53_0.045_27),oklch(0.6_0.24_27))]"
            : "bg-[linear-gradient(140deg,oklch(0.66_0.14_154),oklch(0.5_0.13_162))]"
        )}
        aria-label={callMode ? t("controls.call.endAria") : t("controls.call.startAria")}
        aria-pressed={callMode}
        onClick={onCallToggle}
        disabled={!micSupported || micBlocked}
      >
        {callMode ? <PhoneOff size={18} aria-hidden /> : <Phone size={18} aria-hidden />}
        <span>{callMode ? t("controls.call.end") : t("controls.call.start")}</span>
      </button>
    </div>
  );
}
