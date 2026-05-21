import { Loader2, Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { cx } from "@/lib/uiClasses";
import {
  callButtonBase,
  callButtonEnd,
  callButtonStart,
  micCircleActive,
  micCircleBase
} from "./styles";

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
  const micLabel = isListening ? "Mute microphone" : "Speak now";
  return (
    <div
      className="flex items-center justify-center gap-[clamp(14px,3vw,26px)] pb-1 pt-1.5"
      role="group"
      aria-label="Call controls"
    >
      <button
        className={cx(callButtonBase, callMode ? callButtonEnd : callButtonStart)}
        type="button"
        aria-label={callMode ? "End voice call" : "Start voice call"}
        aria-pressed={callMode}
        onClick={onCallToggle}
        disabled={!micSupported || micBlocked}
      >
        {callMode ? <PhoneOff size={26} aria-hidden /> : <Phone size={26} aria-hidden />}
        <span>{callMode ? "End" : "Call"}</span>
      </button>

      <button
        className={cx(micCircleBase, isListening && micCircleActive)}
        type="button"
        aria-label={micLabel}
        aria-pressed={isListening}
        title={micLabel}
        onClick={onMicClick}
        disabled={!callMode || isStreaming || isTranscribing || micBlocked}
      >
        {isTranscribing ? (
          <Loader2 className="animate-spin-fast" size={20} aria-hidden />
        ) : isListening ? (
          <Mic size={20} aria-hidden />
        ) : (
          <MicOff size={20} aria-hidden />
        )}
      </button>
    </div>
  );
}
