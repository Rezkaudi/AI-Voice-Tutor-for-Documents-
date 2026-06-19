import type { AvatarState, CallStatus } from "@/lib/types";

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

export function deriveStatusLabel(
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
