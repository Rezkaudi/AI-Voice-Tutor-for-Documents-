import {
  AlertTriangle,
  Captions,
  Loader2,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  RotateCcw
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
// import { downloadChatPdf } from "@/lib/chat-pdf";
import type { SpeechCaption } from "@/hooks/use-speech";
import { renderMessageBody } from "@/lib/message-format";
import { ConfirmDialog } from "./ConfirmDialog";
import { MicPermissionDialog } from "./MicPermissionDialog";
import { TeacherAvatar } from "./TeacherAvatar";
import { SPEECH_LANGUAGES, type UiMessage } from "./types";

// Trailing words kept on the one-line caption; older words drop off as the
// teacher speaks, so the strip always fits without clipping.
const CAPTION_WINDOW = 6;

type TeacherStatus = {
  isStreaming: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  isTranscribing: boolean;
  callMode: boolean;
};

type TeacherPanelProps = TeacherStatus & {
  messages: UiMessage[];
  documentTitle: string;
  caption: SpeechCaption | null;
  micSupported: boolean;
  micBlocked: boolean;
  speechLanguage: string;
  error: string | null;
  onSpeechLanguageChange: (language: string) => void;
  onMicToggle: () => void;
  onCallToggle: () => void;
  onClearChat: () => void;
};

/** Avatar-led voice-call panel: transcript, language picker, and call controls. */
export function TeacherPanel({
  messages,
  documentTitle,
  caption,
  isStreaming,
  isSpeaking,
  isListening,
  isTranscribing,
  micSupported,
  micBlocked,
  callMode,
  speechLanguage,
  error,
  onSpeechLanguageChange,
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
  const captionWords =
    caption && caption.spoken > 0
      ? caption.words
          .slice(captionStart, caption.spoken)
          .map((text, i) => ({ text, index: captionStart + i }))
      : [];
  const captionActiveIndex = caption ? caption.spoken - 1 : -1;
  const captionSpeaker = caption?.speaker ?? "teacher";
  const captionSpaced = caption?.spaced ?? true;
  const captionRtl = caption?.rtl ?? false;
  // const canExport = visibleMessages.some((message) => message.content.trim());

  const handleClearClick = () => {
    if (!hasMessages) {
      onClearChat();
    } else {
      setConfirmOpen(true);
    }
  };

  return (
    <div className={`call-stage${callMode ? " in-call" : ""}`}>
      {/* <button
        className="call-export"
        type="button"
        aria-label="Download chat as PDF"
        title="Download chat as PDF"
        onClick={() => downloadChatPdf(messages, documentTitle)}
        disabled={!canExport}
      >
        <Download size={16} aria-hidden />
        <span>PDF</span>
      </button> */}
      <button
        className={`call-corner-btn call-corner-btn--transcript${
          showTranscript ? " is-active" : ""
        }`}
        type="button"
        aria-pressed={showTranscript}
        aria-expanded={showTranscript}
        title={showTranscript ? "Hide the lesson transcript" : "Show the lesson transcript"}
        onClick={() => setShowTranscript((open) => !open)}
      >
        <Captions size={16} aria-hidden />
        <span>{showTranscript ? "Hide" : "Transcript"}</span>
      </button>

      <button
        className="call-corner-btn call-corner-btn--restart"
        type="button"
        aria-label="Clear chat and restart"
        title="Clear chat and restart"
        onClick={handleClearClick}
        disabled={!hasMessages && !callMode}
      >
        <RotateCcw size={16} aria-hidden />
      </button>

      <TeacherAvatar state={orbState} />

      <div className="call-meta">
        <h2>AI Teacher</h2>
        <p role="status" aria-live="polite">
          {statusLabel}
        </p>
        <div className="lang-picker">
          <span className="lang-picker-caption" id="lang-picker-label">
            I speak
          </span>
          <div className="lang-picker-track" role="radiogroup" aria-labelledby="lang-picker-label">
            {SPEECH_LANGUAGES.map((option) => {
              const active = speechLanguage === option.value;
              return (
                <button
                  key={option.value || "auto"}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`lang-pill${active ? " is-active" : ""}`}
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

      <div className="call-stream">
        {error ? (
          <div className="bubble assistant error-text" role="alert">
            {error}
          </div>
        ) : null}

        {showTranscript ? (
          <div ref={logRef} className="call-transcript" aria-live="polite">
            {visibleMessages.length === 0 ? (
              <p className="call-hint">
                No conversation yet — your lesson transcript will appear here.
              </p>
            ) : (
              visibleMessages.map((message) => (
                <div key={message.id} className={`bubble ${message.role}`}>
                  {message.content ? (
                    renderMessageBody(message.content)
                  ) : message.role === "assistant" ? (
                    <span className="thinking-dots" aria-label="Thinking">
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : (
                    ""
                  )}
                </div>
              ))
            )}
          </div>
        ) : !callMode && !error ? (
          <p className="call-hint call-hint--idle">
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
          className={`call-caption call-caption--${captionSpeaker}${
            captionSpaced ? "" : " call-caption--dense"
          }`}
          dir={captionRtl ? "rtl" : "ltr"}
          aria-hidden="true"
        >
          <span className="caption-speaker">
            {captionSpeaker === "user" ? "You" : "Teacher"}
          </span>
          <span className="caption-line">
            {captionWords.map((word, i) => (
              <span
                key={word.index}
                className={`caption-word${
                  word.index === captionActiveIndex ? " is-active" : ""
                }`}
              >
                {captionSpaced && i > 0 ? " " : ""}
                {word.text}
              </span>
            ))}
          </span>
        </div>
      ) : null}

      <div className="call-dock" role="group" aria-label="Call controls">
        <button
          className={`call-cta ${callMode ? "call-cta--end" : "call-cta--start"}`}
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
          className={`dock-btn${isListening ? " is-on" : ""}`}
          type="button"
          aria-label={isListening ? "Mute microphone" : "Speak now"}
          aria-pressed={isListening}
          title={isListening ? "Mute microphone" : "Speak now"}
          onClick={handleMicClick}
          disabled={!callMode || isStreaming || isTranscribing || micBlocked}
        >
          {isTranscribing ? (
            <Loader2 className="spin" size={20} aria-hidden />
          ) : isListening ? (
            <Mic size={20} aria-hidden />
          ) : (
            <MicOff size={20} aria-hidden />
          )}
        </button>
      </div>

      {!micSupported ? (
        <p className="call-warn">
          <AlertTriangle size={14} aria-hidden /> Microphone is not supported in this browser.
        </p>
      ) : micBlocked ? (
        <button
          type="button"
          className="call-warn call-warn--blocked"
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
}: TeacherStatus): string {
  if (isSpeaking) return "speaking";
  if (isListening) return "listening";
  if (isStreaming || isTranscribing) return "thinking";
  return callMode ? "idle-call" : "idle";
}

function deriveStatusLabel(
  { isSpeaking, isListening, isStreaming, isTranscribing, callMode }: TeacherStatus,
  messageCount: number
): string {
  if (isListening) return "Listening — speak now";
  if (isTranscribing) return "Transcribing…";
  if (isStreaming) return "Thinking from the document…";
  if (isSpeaking) return "Speaking";
  if (callMode) return "On call";
  return messageCount === 0 ? "Tap Call to start your lesson" : "Tap Call to keep going";
}
