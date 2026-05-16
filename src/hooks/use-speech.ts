import { useCallback, useRef, useState } from "react";

const MAX_TTS_CHARS = 4000;
const SPEECH_SYNTHESIS_RATE = 0.96;

/**
 * Synthesizes sentences as they stream in and plays the resulting clips
 * strictly in order, even if a later fetch resolves first.
 */
export type SpeechSession = {
  push: (sentence: string) => void;
  finished: () => Promise<void>;
};

export type SpeechController = {
  isSpeaking: boolean;
  stopSpeaking: () => void;
  createSpeechSession: () => SpeechSession;
};

export function useSpeech(): SpeechController {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Monotonic id: bumping it invalidates every in-flight TTS fetch/playback.
  const sessionIdRef = useRef(0);

  const stopSpeaking = useCallback(() => {
    sessionIdRef.current += 1;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      revokeBlobUrl(audio.src);
      audio.removeAttribute("src");
      audio.load();
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const createSpeechSession = useCallback((): SpeechSession => {
    const sessionId = ++sessionIdRef.current;
    const isStale = () => sessionId !== sessionIdRef.current;
    let chain: Promise<void> = Promise.resolve();

    function push(sentence: string) {
      const text = sentence.trim().slice(0, MAX_TTS_CHARS);
      if (!text) {
        return;
      }

      // Start synthesis immediately so it overlaps with playback of earlier clips.
      const clip: Promise<Blob | null> = isStale()
        ? Promise.resolve(null)
        : fetchSpeechClip(text);

      chain = chain.then(async () => {
        if (isStale()) return;
        const blob = await clip;
        if (isStale()) return;

        if (blob) {
          await playClip(audioRef, setIsSpeaking, blob, isStale);
        } else {
          // Fall back to browser speech if server TTS is unavailable (no API key).
          await playWithSpeechSynthesis(setIsSpeaking, text, isStale);
        }
      });
    }

    return { push, finished: () => chain };
  }, []);

  return { isSpeaking, stopSpeaking, createSpeechSession };
}

function fetchSpeechClip(text: string): Promise<Blob | null> {
  return fetch("/api/speak", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text })
  })
    .then((response) => (response.ok ? response.blob() : null))
    .catch(() => null);
}

function playClip(
  audioRef: React.MutableRefObject<HTMLAudioElement | null>,
  setIsSpeaking: (value: boolean) => void,
  blob: Blob,
  isStale: () => boolean
): Promise<void> {
  return new Promise<void>((resolve) => {
    const audio = audioRef.current ?? new Audio();
    audioRef.current = audio;
    revokeBlobUrl(audio.src);

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      setIsSpeaking(false);
      resolve();
    };

    audio.src = URL.createObjectURL(blob);
    audio.onplay = () => setIsSpeaking(true);
    audio.onended = finish;
    audio.onerror = finish;
    audio.onpause = () => {
      // stopSpeaking() pauses playback; release the chain so it can unwind.
      if (isStale()) {
        finish();
      }
    };
    audio.play().catch(finish);
  });
}

function playWithSpeechSynthesis(
  setIsSpeaking: (value: boolean) => void,
  text: string,
  isStale: () => boolean
): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || isStale()) {
      resolve();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = SPEECH_SYNTHESIS_RATE;

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      setIsSpeaking(false);
      resolve();
    };

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.speak(utterance);
  });
}

function revokeBlobUrl(url: string): void {
  if (url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}
