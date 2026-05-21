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
