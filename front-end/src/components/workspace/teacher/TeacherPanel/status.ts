import type { AvatarState, CallStatus } from "@/types";

export function deriveOrbState({
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

export function deriveDockStatus(status: CallStatus): {
  tone: AvatarState;
  label: string;
  interruptible: boolean;
} {
  const { isSpeaking, isListening, isStreaming, isTranscribing, callMode } = status;
  if (isListening) return { tone: "listening", label: "Listening — your turn", interruptible: false };
  if (isTranscribing) return { tone: "thinking", label: "Got that…", interruptible: false };
  if (isSpeaking) return { tone: "speaking", label: "Speaking", interruptible: true };
  if (isStreaming) return { tone: "thinking", label: "Thinking…", interruptible: false };
  if (callMode) return { tone: "idle-call", label: "Ready when you are", interruptible: false };
  return { tone: "idle", label: "", interruptible: false };
}

type StatusLabelKey =
  | "teacher.status.listeningNow"
  | "teacher.status.transcribing"
  | "teacher.status.thinkingDoc"
  | "teacher.status.speaking"
  | "teacher.status.onCall"
  | "teacher.status.tapStart"
  | "teacher.status.tapContinue";

/**
 * Returns the i18n key for the panel's status line. The caller translates it,
 * so this stays a pure function with no React/i18n dependency.
 */
export function deriveStatusLabelKey(
  { isSpeaking, isListening, isStreaming, isTranscribing, callMode }: CallStatus,
  messageCount: number
): StatusLabelKey {
  if (isListening) return "teacher.status.listeningNow";
  if (isTranscribing) return "teacher.status.transcribing";
  if (isStreaming) return "teacher.status.thinkingDoc";
  if (isSpeaking) return "teacher.status.speaking";
  if (callMode) return "teacher.status.onCall";
  return messageCount === 0 ? "teacher.status.tapStart" : "teacher.status.tapContinue";
}
