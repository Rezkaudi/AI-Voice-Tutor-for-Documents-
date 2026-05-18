import { useCallback, useRef, useState } from "react";

const MAX_TTS_CHARS = 4000;
const SPEECH_SYNTHESIS_RATE = 0.96;
// Fallback per-word pace (seconds) when an audio clip exposes no duration.
const ESTIMATED_WORD_SECONDS = 0.34;

/** Who the live caption belongs to — drives its colour and label. */
export type CaptionSpeaker = "teacher" | "user";

/**
 * Live caption for the sentence currently being spoken: who is speaking, the
 * full word list, and how many of those words have been voiced so far. The
 * last spoken word is the "active" one — see `TeacherPanel` for the rolling
 * one-line render.
 */
export type SpeechCaption = {
  speaker: CaptionSpeaker;
  words: string[];
  spoken: number;
};

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
  /** Word-synced caption for the active sentence, or null when silent. */
  caption: SpeechCaption | null;
  stopSpeaking: () => void;
  createSpeechSession: () => SpeechSession;
  /**
   * Plays back the learner's just-transcribed sentence as a caption, in the
   * same rolling style as the teacher's. There is no audio to sync to (speech
   * is transcribed in one batch), so the reveal is paced by an estimate.
   */
  showUserCaption: (text: string) => void;
};

export function useSpeech(): SpeechController {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [caption, setCaption] = useState<SpeechCaption | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Monotonic id: bumping it invalidates every in-flight TTS fetch/playback.
  const sessionIdRef = useRef(0);
  // Aborts the active session's `/api/speak` fetches outright, not just stale-checks them.
  const speakAbortRef = useRef<AbortController | null>(null);
  // The word-reveal interval driving the live caption; cleared on stop/finish.
  const captionTimerRef = useRef<number | null>(null);

  const clearCaptionTimer = useCallback(() => {
    if (captionTimerRef.current !== null) {
      window.clearInterval(captionTimerRef.current);
      captionTimerRef.current = null;
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    sessionIdRef.current += 1;
    speakAbortRef.current?.abort();
    speakAbortRef.current = null;
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
    clearCaptionTimer();
    setCaption(null);
    setIsSpeaking(false);
  }, [clearCaptionTimer]);

  const createSpeechSession = useCallback((): SpeechSession => {
    const sessionId = ++sessionIdRef.current;
    const isStale = () => sessionId !== sessionIdRef.current;
    const controller = new AbortController();
    speakAbortRef.current = controller;
    let chain: Promise<void> = Promise.resolve();

    const captionApi: CaptionApi = { setCaption, captionTimerRef, clearCaptionTimer };

    function push(sentence: string) {
      const text = sentence.trim().slice(0, MAX_TTS_CHARS);
      if (!text) {
        return;
      }

      // Start synthesis immediately so it overlaps with playback of earlier clips.
      const clip: Promise<Blob | null> = isStale()
        ? Promise.resolve(null)
        : fetchSpeechClip(text, controller.signal);

      chain = chain.then(async () => {
        if (isStale()) return;
        const blob = await clip;
        if (isStale()) return;

        if (blob) {
          await playClip(audioRef, setIsSpeaking, blob, isStale, text, captionApi);
        } else {
          // Fall back to browser speech if server TTS is unavailable (no API key).
          await playWithSpeechSynthesis(setIsSpeaking, text, isStale, captionApi);
        }
      });
    }

    return {
      push,
      finished: () =>
        chain.then(() => {
          // Whole answer voiced: drop the caption once the queue drains.
          if (!isStale()) {
            clearCaptionTimer();
            setCaption(null);
          }
        })
    };
  }, [clearCaptionTimer]);

  const showUserCaption = useCallback(
    (text: string) => {
      const words = splitWords(text);
      if (words.length === 0) return;
      startWordReveal(
        { setCaption, captionTimerRef, clearCaptionTimer },
        words,
        words.length * ESTIMATED_WORD_SECONDS * 1000,
        "user"
      );
    },
    [clearCaptionTimer]
  );

  return { isSpeaking, caption, stopSpeaking, createSpeechSession, showUserCaption };
}

type CaptionApi = {
  setCaption: (caption: SpeechCaption | null) => void;
  captionTimerRef: React.MutableRefObject<number | null>;
  clearCaptionTimer: () => void;
};

function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * Reveals the sentence one word at a time, pacing the reveal to fit `durationMs`
 * so the caption tracks the audio.
 */
function startWordReveal(
  { setCaption, captionTimerRef, clearCaptionTimer }: CaptionApi,
  words: string[],
  durationMs: number,
  speaker: CaptionSpeaker
): void {
  clearCaptionTimer();
  if (words.length === 0) {
    setCaption(null);
    return;
  }

  let spoken = 1;
  setCaption({ speaker, words, spoken });
  if (words.length === 1) {
    return;
  }

  const step = Math.max(140, durationMs / words.length);
  captionTimerRef.current = window.setInterval(() => {
    spoken += 1;
    setCaption({ speaker, words, spoken: Math.min(spoken, words.length) });
    if (spoken >= words.length) {
      clearCaptionTimer();
    }
  }, step);
}

function fetchSpeechClip(text: string, signal?: AbortSignal): Promise<Blob | null> {
  return fetch("/api/speak", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
    signal
  })
    .then((response) => (response.ok ? response.blob() : null))
    .catch(() => null);
}

function playClip(
  audioRef: React.MutableRefObject<HTMLAudioElement | null>,
  setIsSpeaking: (value: boolean) => void,
  blob: Blob,
  isStale: () => boolean,
  text: string,
  captionApi: CaptionApi
): Promise<void> {
  return new Promise<void>((resolve) => {
    const audio = audioRef.current ?? new Audio();
    audioRef.current = audio;
    revokeBlobUrl(audio.src);

    const words = splitWords(text);
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      setIsSpeaking(false);
      resolve();
    };

    audio.src = URL.createObjectURL(blob);
    audio.onplay = () => {
      setIsSpeaking(true);
      // Prefer the real clip length; fall back to an estimate if it is unknown.
      const seconds =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : words.length * ESTIMATED_WORD_SECONDS;
      startWordReveal(captionApi, words, seconds * 1000, "teacher");
    };
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
  isStale: () => boolean,
  captionApi: CaptionApi
): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || isStale()) {
      resolve();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = SPEECH_SYNTHESIS_RATE;

    const words = splitWords(text);
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      setIsSpeaking(false);
      resolve();
    };

    utterance.onstart = () => {
      setIsSpeaking(true);
      // The browser reports real word boundaries, so estimate as a safety net only.
      startWordReveal(
        captionApi,
        words,
        words.length * ESTIMATED_WORD_SECONDS * 1000,
        "teacher"
      );
    };
    // Boundary events give exact word timing — far better than the estimate.
    utterance.onboundary = (event) => {
      if (event.name !== "word") return;
      const spoken = countWordsUpTo(text, event.charIndex);
      if (spoken > 0) {
        captionApi.clearCaptionTimer();
        captionApi.setCaption({
          speaker: "teacher",
          words,
          spoken: Math.min(spoken, words.length)
        });
      }
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.speak(utterance);
  });
}

/** Counts how many whitespace-delimited words begin at or before `charIndex`. */
function countWordsUpTo(text: string, charIndex: number): number {
  const matched = text.slice(0, charIndex + 1).match(/\S+/g);
  return matched ? matched.length : 0;
}

function revokeBlobUrl(url: string): void {
  if (url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}
