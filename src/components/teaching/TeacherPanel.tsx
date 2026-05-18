import {
  AlertTriangle,
  Loader2,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  RotateCcw
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
// import { downloadChatPdf } from "@/lib/chat-pdf";
import { renderMessageBody } from "@/lib/message-format";
import { ConfirmDialog } from "./ConfirmDialog";
import { MicPermissionDialog } from "./MicPermissionDialog";
import { TeacherAvatar } from "./TeacherAvatar";
import { SPEECH_LANGUAGES, type UiMessage } from "./types";

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

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

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
        className="call-export"
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

      <div ref={logRef} className="call-transcript" aria-live="polite">
        {visibleMessages.length === 0 && !callMode ? (
          <p className="call-hint">
            Press <strong>Call</strong>. Your teacher will introduce the lesson and listen for
            your reply — no typing needed.
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
        {error ? (
          <div className="bubble assistant error-text" role="alert">
            {error}
          </div>
        ) : null}
      </div>

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
