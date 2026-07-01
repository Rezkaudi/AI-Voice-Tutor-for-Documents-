import { useEffect, useState } from "react";
import { thinkingSound } from "@/services/speech/thinkingSound";
import type { CallStatus } from "@/types";

export function useThinkingCue(status: CallStatus): boolean {
  const { callMode, isPaused, isStreaming, isTranscribing, isSpeaking, isPreparing } = status;

  const working = isTranscribing || isStreaming || !!isPreparing;

  const [spoke, setSpoke] = useState(false);
  if (!working || !callMode) {
    if (spoke) setSpoke(false);
  } else if (isSpeaking && !spoke) {
    setSpoke(true);
  }

  const isThinking =
    callMode && !isPaused && working && !isSpeaking && !spoke;

  useEffect(() => {
    if (isThinking) thinkingSound.start();
    else thinkingSound.stop();
  }, [isThinking]);

  useEffect(() => () => thinkingSound.stop(), []);

  return isThinking;
}
