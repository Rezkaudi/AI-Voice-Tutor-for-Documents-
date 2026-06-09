import { Loader2, Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { cx } from "@/lib/uiClasses";
import {
  callButtonBase,
  callButtonEnd,
  callButtonStart,
  micCircleActive,
  micCircleBase
} from "./styles";

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

interface CallControlsProps {
  callMode: boolean;
  isListening: boolean;
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
  isStreaming,
  isTranscribing,
  micSupported,
  micBlocked,
  onCallToggle,
  onMicClick
}: CallControlsProps) {
  // While the teacher is talking, the mic doubles as a barge-in: tapping it
  // cuts the answer short and hands the floor to the learner.
  const isTeacherTalking = isStreaming && !isListening;
  const micLabel = isListening
    ? "Mute microphone"
    : isTeacherTalking
      ? "Interrupt and speak"
      : "Speak now";
  return (
    <div
      className="flex items-center justify-center gap-[clamp(14px,3vw,26px)] pb-1 pt-1.5"
      role="group"
      aria-label="Call controls"
    >
      <button
        className={cx(micCircleBase, isListening && micCircleActive)}
        type="button"
        aria-label={micLabel}
        aria-pressed={isListening}
        title={micLabel}
        onClick={onMicClick}
        disabled={!callMode || isTranscribing || micBlocked}
      >
        {isTranscribing ? (
          <Loader2 className="animate-spin-fast" size={26} aria-hidden />
        ) : isListening ? (
          <VoiceWave />
        ) : isTeacherTalking ? (
          <Mic size={26} aria-hidden />
        ) : (
          <MicOff size={26} aria-hidden />
        )}
      </button>

      <button
        className={cx(callButtonBase, callMode ? callButtonEnd : callButtonStart)}
        type="button"
        aria-label={callMode ? "End voice call" : "Start voice call"}
        aria-pressed={callMode}
        onClick={onCallToggle}
        disabled={!micSupported || micBlocked}
      >
        {callMode ? <PhoneOff size={26} aria-hidden /> : <Phone size={26} aria-hidden />}
      </button>
    </div>
  );
}
