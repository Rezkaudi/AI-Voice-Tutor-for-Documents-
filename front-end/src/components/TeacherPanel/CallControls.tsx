import { Loader2, Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "@/lib/uiClasses";
import {
  callButtonBase,
  callButtonEnd,
  callButtonStart,
  micCircleActive,
  micCircleBase,
  micCircleThinking
} from "./styles";
import { deriveDockStatus } from "./status";

/** Animated purple voice equalizer shown while the mic is capturing the learner. */
function VoiceWave() {
  return (
    <span className="flex h-7 items-center gap-[3px]" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-[3px] min-h-[6px] rounded-full bg-current animate-wave-bar motion-reduce:animate-none"
          style={{ animationDelay: `${i * 110}ms` }}
        />
      ))}
    </span>
  );
}

/** Three bouncing dots — the universal "preparing a reply" signal. */
function ThinkingDots() {
  return (
    <span className="flex h-7 items-center gap-[5px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-[6px] w-[6px] rounded-full bg-current animate-dot-bounce motion-reduce:animate-none"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  );
}

interface CallControlsProps {
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

/** Bottom dock: Call (start/end) + Mic (mute/speak). */
export function CallControls({
  callMode,
  isListening,
  isSpeaking,
  isStreaming,
  isTranscribing,
  micSupported,
  micBlocked,
  onCallToggle,
  onMicClick
}: CallControlsProps) {
  const { t } = useTranslation();

  const dock = deriveDockStatus({ isSpeaking, isListening, isStreaming, isTranscribing, callMode });
  // Reply is being prepared but nothing is audible yet — nothing to interrupt,
  // so the mic shows a disabled "thinking" state instead of a barge-in cue.
  const isThinking = callMode && dock.tone === "thinking";
  const isTeacherTalking = isSpeaking && !isListening;
  const micLabel = isListening
    ? t("controls.mic.muteAria")
    : isThinking
      ? t("controls.mic.thinkingAria")
      : isTeacherTalking
        ? t("controls.mic.interruptAria")
        : t("controls.mic.speakAria");
  return (
    <div
      className="flex items-center justify-center gap-[clamp(14px,3vw,26px)] pb-1 pt-1.5"
      role="group"
      aria-label={t("controls.callControls")}
    >
      <button
        className={cx(
          micCircleBase,
          isListening && micCircleActive,
          isThinking && micCircleThinking
        )}
        type="button"
        aria-label={micLabel}
        aria-pressed={isListening}
        title={micLabel}
        onClick={onMicClick}
        disabled={!callMode || isTranscribing || micBlocked || isThinking}
      >
        {isTranscribing ? (
          <Loader2 className="animate-spin-fast" size={26} aria-hidden />
        ) : isListening ? (
          <VoiceWave />
        ) : isThinking ? (
          <ThinkingDots />
        ) : isTeacherTalking ? (
          <Mic size={26} aria-hidden />
        ) : (
          <MicOff size={26} aria-hidden />
        )}
      </button>

      <button
        className={cx(callButtonBase, callMode ? callButtonEnd : callButtonStart)}
        type="button"
        aria-label={callMode ? t("controls.call.endAria") : t("controls.call.startAria")}
        aria-pressed={callMode}
        onClick={onCallToggle}
        disabled={!micSupported || micBlocked}
      >
        {callMode ? <PhoneOff size={26} aria-hidden /> : <Phone size={26} aria-hidden />}
      </button>
    </div>
  );
}
