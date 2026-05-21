import {
  AlertTriangle,
  Captions,
  Leaf,
  Loader2,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  RotateCcw
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SPEECH_LANGUAGES } from "@/lib/constants";
import { renderMessageBody } from "@/lib/messageFormat";
import { cx } from "@/lib/uiClasses";
import type {
  AvatarState,
  CallStatus,
  CaptionSpeaker,
  ChatMessage,
  SpeechCaption,
  SpeechLanguage
} from "@/lib/types";
import { ConfirmDialog } from "./ConfirmDialog";
import { MicPermissionDialog } from "./MicPermissionDialog";
import { TeacherAvatar } from "./TeacherAvatar";

// Trailing words kept on the one-line caption; older words drop off as the
// teacher speaks, so the strip always fits without clipping.
const CAPTION_WINDOW = 6;

const cornerButton =
  "absolute top-3 z-20 inline-flex min-h-10 min-w-10 items-center justify-center gap-[7px] rounded-full border border-[oklch(1_0_0_/_0.26)] bg-[oklch(0.17_0.025_244_/_0.74)] px-3 max-[480px]:px-2.5 sm:px-[15px] text-[0.8rem] font-semibold tracking-[0.01em] text-[oklch(0.97_0.01_215)] shadow-[0_6px_18px_oklch(0.1_0.03_244_/_0.5)] backdrop-blur-[10px] [transition:transform_160ms_cubic-bezier(0.16,1,0.3,1),background-color_160ms_ease-out,border-color_160ms_ease-out] disabled:cursor-not-allowed disabled:opacity-[0.42] [&:hover:not(:disabled)]:-translate-y-px [&:hover:not(:disabled)]:border-[oklch(0.78_0.13_165_/_0.7)] [&:hover:not(:disabled)]:bg-[oklch(0.22_0.03_244_/_0.85)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.78_0.13_165)]";
const cornerLabel = "hidden sm:inline";
const cornerButtonActive =
  "!border-transparent !bg-[oklch(0.82_0.13_165)] !text-[oklch(0.18_0.04_230)] [&:hover:not(:disabled)]:!border-transparent [&:hover:not(:disabled)]:!bg-[oklch(0.86_0.13_165)]";
const bubbleBase =
  "w-fit max-w-[92%] whitespace-pre-wrap rounded-[14px] px-[13px] py-2.5 text-[0.94rem] leading-[1.55] [&_p]:mb-1.5 [&_p]:mt-0 [&_p:last-child]:mb-0";
const callHint = "text-center text-[0.92rem] leading-[1.55] text-[oklch(0.82_0.02_215)] px-3";
const captionBase =
  "pointer-events-none absolute bottom-[clamp(96px,15vh,148px)] left-1/2 z-30 flex max-w-[min(580px,calc(100%_-_24px))] -translate-x-1/2 flex-nowrap items-center gap-[9px] overflow-hidden rounded-2xl border border-[oklch(1_0_0_/_0.1)] bg-[oklch(0.13_0.022_244_/_0.9)] px-3.5 py-[9px] shadow-[0_14px_36px_oklch(0.05_0.02_244_/_0.6)] backdrop-blur-[10px] animate-caption-rise motion-reduce:animate-none";

interface TeacherPanelProps {
  messages: ChatMessage[];
  caption: SpeechCaption | null;
  isStreaming: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  isTranscribing: boolean;
  micSupported: boolean;
  micBlocked: boolean;
  callMode: boolean;
  speechLanguage: SpeechLanguage;
  saveCost: boolean;
  error: string | null;
  onSpeechLanguageChange: (language: SpeechLanguage) => void;
  onSaveCostToggle: () => void;
  onMicToggle: () => void;
  onCallToggle: () => void | Promise<void>;
  onClearChat: () => void;
}

interface CaptionWord {
  text: string;
  index: number;
}

/** Avatar-led voice-call panel: transcript, language picker, and call controls. */
export function TeacherPanel({
  messages,
  caption,
  isStreaming,
  isSpeaking,
  isListening,
  isTranscribing,
  micSupported,
  micBlocked,
  callMode,
  speechLanguage,
  saveCost,
  error,
  onSpeechLanguageChange,
  onSaveCostToggle,
  onMicToggle,
  onCallToggle,
  onClearChat
}: TeacherPanelProps) {
  const logRef = useRef<HTMLDivElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [micDialogOpen, setMicDialogOpen] = useState(false);
  // Transcript starts hidden — the call leads with the avatar and live caption;
  // the learner opts into the full text history.
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    if (showTranscript) {
      logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
    }
  }, [messages, showTranscript]);

  // Pop the dialog up the moment a block is detected; close it automatically
  // once the user re-enables the mic (micBlocked flips back to false).
  useEffect(() => {
    // Mirror the blocked state into the dialog: open it on a block, close it
    // once the user re-enables the mic. Intentional state sync with an
    // external (browser permission) system.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMicDialogOpen(micBlocked);
  }, [micBlocked]);

  // While blocked, the mic button explains the fix instead of failing silently.
  const handleMicClick = () => {
    if (micBlocked) {
      setMicDialogOpen(true);
      return;
    }
    onMicToggle();
  };

  const status = { isStreaming, isSpeaking, isListening, isTranscribing, callMode };
  const orbState = deriveOrbState(status);
  const statusLabel = deriveStatusLabel(status, messages.length);
  const visibleMessages = messages.filter((message) => !message.hidden);
  const hasMessages = messages.length > 0;
  // Only the last few voiced words, so the one-line strip always fits.
  const captionStart =
    caption && caption.spoken > 0 ? Math.max(0, caption.spoken - CAPTION_WINDOW) : 0;
  const captionWords: CaptionWord[] =
    caption && caption.spoken > 0
      ? caption.words
          .slice(captionStart, caption.spoken)
          .map((text, i) => ({ text, index: captionStart + i }))
      : [];
  const captionActiveIndex = caption ? caption.spoken - 1 : -1;
  const captionSpeaker: CaptionSpeaker = caption?.speaker ?? "teacher";
  const captionSpaced = caption?.spaced ?? true;
  const captionRtl = caption?.rtl ?? false;

  const handleClearClick = () => {
    if (!hasMessages) {
      onClearChat();
    } else {
      setConfirmOpen(true);
    }
  };

  return (
    <div className="relative grid h-full min-h-0 w-full flex-1 grid-rows-[auto_auto_minmax(0,1fr)_auto] place-items-center gap-[clamp(14px,2.2vh,26px)] px-3 pb-1 pt-[clamp(60px,8vh,72px)]">
      <button
        className={cx(cornerButton, "left-3", showTranscript && cornerButtonActive)}
        type="button"
        aria-pressed={showTranscript}
        aria-expanded={showTranscript}
        aria-label={showTranscript ? "Hide the lesson transcript" : "Show the lesson transcript"}
        title={showTranscript ? "Hide the lesson transcript" : "Show the lesson transcript"}
        onClick={() => setShowTranscript((open) => !open)}
      >
        <Captions size={16} aria-hidden />
        <span className={cornerLabel}>{showTranscript ? "Hide" : "Transcript"}</span>
      </button>

      <button
        className={cx(cornerButton, "right-[58px] sm:right-[76px]", saveCost && cornerButtonActive)}
        type="button"
        aria-pressed={saveCost}
        aria-label={
          saveCost
            ? "Save-cost mode is on — using the lighter, cheaper tutor model"
            : "Turn on save-cost mode to use a cheaper tutor model"
        }
        title={
          saveCost
            ? "Save-cost mode is on — using the lighter, cheaper tutor model"
            : "Turn on save-cost mode to use a cheaper tutor model"
        }
        onClick={onSaveCostToggle}
        disabled={isStreaming || isListening || isTranscribing}
      >
        <Leaf size={16} aria-hidden />
        <span className={cornerLabel}>Save-cost{saveCost ? " · On" : ""}</span>
      </button>

      <button
        className={cx(cornerButton, "right-3")}
        type="button"
        aria-label="Clear chat and restart"
        title="Clear chat and restart"
        onClick={handleClearClick}
        disabled={!hasMessages && !callMode}
      >
        <RotateCcw size={16} aria-hidden />
      </button>

      <TeacherAvatar state={orbState} />

      <div className="text-center">
        <h2 className="m-0 text-[1.15rem] font-bold tracking-[0.01em]">AI Teacher</h2>
        <p className="mb-0 mt-1 text-[0.9rem] text-[oklch(0.82_0.02_215)]" role="status" aria-live="polite">
          {statusLabel}
        </p>
        <div className="mt-3 flex flex-col items-center gap-1.5">
          <span
            className="text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-[oklch(0.66_0.02_215)]"
            id="lang-picker-label"
          >
            I speak
          </span>
          <div
            className="inline-flex max-w-full flex-nowrap justify-start gap-0.5 overflow-x-auto rounded-full border border-[oklch(0.4_0.03_220_/_0.7)] bg-[oklch(0.22_0.03_230)] p-[3px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="radiogroup"
            aria-labelledby="lang-picker-label"
          >
            {SPEECH_LANGUAGES.map((option) => {
              const active = speechLanguage === option.value;
              return (
                <button
                  key={option.value || "auto"}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={cx(
                    "min-h-[38px] appearance-none rounded-full border-0 bg-transparent px-4 py-2 text-[0.8rem] font-semibold leading-none text-[oklch(0.78_0.02_215)] transition-colors duration-[160ms] ease-out disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.78_0.13_165)] [&:hover:not(:disabled)]:bg-[oklch(0.3_0.03_230)] [&:hover:not(:disabled)]:text-[oklch(0.92_0.01_215)]",
                    active &&
                      "!bg-[oklch(0.78_0.13_165)] !text-[oklch(0.18_0.04_230)]"
                  )}
                  onClick={() => onSpeechLanguageChange(option.value)}
                  disabled={isListening || isTranscribing || micBlocked}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex h-full min-h-0 w-full max-w-[520px] flex-col items-center justify-center gap-2.5">
        {error ? (
          <div
            className={cx(
              bubbleBase,
              "self-start rounded-bl bg-[oklch(0.31_0.07_30)] font-semibold text-[oklch(0.86_0.1_32)] border border-[oklch(0.5_0.12_30)]"
            )}
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {showTranscript ? (
          <div
            ref={logRef}
            className="flex min-h-0 w-full flex-auto flex-col gap-2.5 overflow-y-auto overscroll-contain px-1 pb-3 pt-1 [scrollbar-color:oklch(0.5_0.04_230)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[oklch(0.5_0.04_230_/_0.6)] [&::-webkit-scrollbar]:w-1.5"
            aria-live="polite"
          >
            {visibleMessages.length === 0 ? (
              <p className={callHint}>
                No conversation yet — your lesson transcript will appear here.
              </p>
            ) : (
              visibleMessages.map((message) => (
                <div
                  key={message.id}
                  className={cx(
                    bubbleBase,
                    message.role === "assistant"
                      ? "self-start rounded-bl bg-[oklch(0.34_0.035_232)] text-[oklch(0.96_0.008_100)] border border-[oklch(0.44_0.04_230)]"
                      : "self-end rounded-br bg-accent text-[oklch(0.98_0.008_138)]"
                  )}
                >
                  {message.content ? (
                    renderMessageBody(message.content)
                  ) : message.role === "assistant" ? (
                    <span className="inline-flex gap-1 py-1" aria-label="Thinking">
                      <i className="h-1.5 w-1.5 animate-dot-bounce rounded-full bg-current opacity-55" />
                      <i className="h-1.5 w-1.5 animate-dot-bounce rounded-full bg-current opacity-55 [animation-delay:0.15s]" />
                      <i className="h-1.5 w-1.5 animate-dot-bounce rounded-full bg-current opacity-55 [animation-delay:0.3s]" />
                    </span>
                  ) : (
                    ""
                  )}
                </div>
              ))
            )}
          </div>
        ) : !callMode && !error ? (
          <p className={cx(callHint, "mx-auto max-w-[340px]")}>
            Press <strong>Call</strong>. Your teacher will introduce the lesson and
            listen for your reply — no typing needed.
          </p>
        ) : null}
      </div>

      {/* Live caption — a video-style subtitle strip overlaid above the call
          dock. Decorative: word-by-word updates would flood a screen reader,
          and the status label in `.call-meta` already carries the live region. */}
      {captionWords.length > 0 ? (
        <div
          className={cx(
            captionBase,
            captionSpeaker === "user" && "border-[oklch(0.78_0.14_150_/_0.34)]"
          )}
          dir={captionRtl ? "rtl" : "ltr"}
          aria-hidden="true"
        >
          <span
            className={cx(
              "flex-none whitespace-nowrap rounded-full px-[9px] py-[3px] text-[0.62rem] font-bold uppercase tracking-[0.07em]",
              captionSpeaker === "user"
                ? "bg-[oklch(0.8_0.14_150)] text-[oklch(0.17_0.04_150)]"
                : "bg-[oklch(0.82_0.13_90)] text-[oklch(0.18_0.04_60)]"
            )}
          >
            {captionSpeaker === "user" ? "You" : "Teacher"}
          </span>
          <span className="block min-w-0 flex-[0_1_auto] overflow-hidden whitespace-nowrap text-center">
            {captionWords.map((word, i) => (
              <span
                key={word.index}
                className={cx(
                  "text-[clamp(1.02rem,2.5vh,1.32rem)] font-semibold leading-[1.35] text-[oklch(0.68_0.015_215)] transition-colors duration-[160ms] ease-out",
                  word.index === captionActiveIndex &&
                    (captionSpeaker === "user"
                      ? "text-[oklch(0.92_0.12_150)] [text-shadow:0_0_12px_oklch(0.78_0.14_150_/_0.5)]"
                      : "text-[oklch(0.97_0.035_95)] [text-shadow:0_0_12px_oklch(0.85_0.13_90_/_0.5)]")
                )}
              >
                {captionSpaced && i > 0 ? " " : ""}
                {word.text}
              </span>
            ))}
          </span>
        </div>
      ) : null}

      <div className="flex items-center justify-center gap-[clamp(14px,3vw,26px)] pb-1 pt-1.5" role="group" aria-label="Call controls">
        <button
          className={cx(
            "inline-flex h-16 min-w-[116px] items-center gap-2.5 rounded-full border-0 px-[22px] text-base font-bold tracking-[0.02em] text-[oklch(0.99_0.005_100)] shadow-[0_14px_32px_oklch(0.18_0.04_244_/_0.55)] transition-[transform,box-shadow,filter] duration-[160ms] ease-out disabled:cursor-not-allowed disabled:opacity-50 [&:active:not(:disabled)]:translate-y-0 [&:active:not(:disabled)]:scale-[0.98] [&:hover:not(:disabled)]:-translate-y-px [&:hover:not(:disabled)]:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[oklch(0.82_0.09_200)]",
            callMode
              ? "animate-listen-pulse-slow bg-[linear-gradient(140deg,oklch(0.62_0.18_28),oklch(0.5_0.18_22))]"
              : "bg-[linear-gradient(140deg,oklch(0.66_0.14_154),oklch(0.5_0.13_162))]"
          )}
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
          className={cx(
            "grid h-[52px] w-[52px] place-items-center rounded-full border border-[oklch(0.46_0.04_230)] bg-[oklch(0.32_0.035_232)] text-[oklch(0.94_0.012_100)] transition-[transform,background,border-color] duration-[160ms] ease-out disabled:cursor-not-allowed disabled:opacity-[0.42] [&:hover:not(:disabled)]:-translate-y-px [&:hover:not(:disabled)]:bg-[oklch(0.38_0.04_232)] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[oklch(0.82_0.09_200)]",
            isListening &&
              "animate-listen-pulse border-[oklch(0.7_0.13_154)] bg-[oklch(0.55_0.11_154)] text-[oklch(0.99_0.008_138)]"
          )}
          type="button"
          aria-label={isListening ? "Mute microphone" : "Speak now"}
          aria-pressed={isListening}
          title={isListening ? "Mute microphone" : "Speak now"}
          onClick={handleMicClick}
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

      {!micSupported ? (
        <p className="m-0 inline-flex items-center gap-1.5 text-[0.82rem] text-[oklch(0.85_0.1_70)]">
          <AlertTriangle size={14} aria-hidden /> Microphone is not supported in this browser.
        </p>
      ) : micBlocked ? (
        <button
          type="button"
          className="m-0 inline-flex max-w-lg cursor-pointer items-center gap-1.5 rounded-full border border-[oklch(0.55_0.13_45_/_0.6)] bg-[oklch(0.28_0.07_40_/_0.55)] px-3.5 py-2 text-left text-[0.82rem] leading-[1.4] text-[oklch(0.9_0.07_60)] transition-[background] duration-150 ease-out hover:bg-[oklch(0.32_0.08_40_/_0.7)] [&_svg]:shrink-0"
          onClick={() => setMicDialogOpen(true)}
        >
          <AlertTriangle size={14} aria-hidden />
          <span>
            Microphone is <strong>blocked</strong>. Tap here for steps to turn it back on.
          </span>
        </button>
      ) : null}

      <MicPermissionDialog open={micDialogOpen} onClose={() => setMicDialogOpen(false)} />

      <ConfirmDialog
        open={confirmOpen}
        title="Restart the lesson?"
        body="This clears the current chat and starts a fresh session from the beginning. This action cannot be undone."
        confirmLabel="Clear & restart"
        cancelLabel="Cancel"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          onClearChat();
        }}
      />
    </div>
  );
}

function deriveOrbState({
  isSpeaking,
  isListening,
  isStreaming,
  isTranscribing,
  callMode
}: CallStatus): AvatarState {
  if (isSpeaking) return "speaking";
  if (isListening) return "listening";
  if (isStreaming || isTranscribing) return "thinking";
  return callMode ? "idle-call" : "idle";
}

function deriveStatusLabel(
  { isSpeaking, isListening, isStreaming, isTranscribing, callMode }: CallStatus,
  messageCount: number
): string {
  if (isListening) return "Listening — speak now";
  if (isTranscribing) return "Transcribing…";
  if (isStreaming) return "Thinking from the document…";
  if (isSpeaking) return "Speaking";
  if (callMode) return "On call";
  return messageCount === 0 ? "Tap Call to start your lesson" : "Tap Call to keep going";
}
