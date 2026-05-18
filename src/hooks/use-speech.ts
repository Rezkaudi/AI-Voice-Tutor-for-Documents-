import { useCallback, useRef, useState } from "react";

const MAX_TTS_CHARS = 4000;
const SPEECH_SYNTHESIS_RATE = 0.96;
// Fallback per-word pace (seconds) when an audio clip exposes no duration.
const ESTIMATED_WORD_SECONDS = 0.34;

/** Who the live caption belongs to — drives its colour and label. */
export type CaptionSpeaker = "teacher" | "user";

/**
 * Live caption for the sentence currently being spoken: who is speaking, the
 * word list, and how many of those words have been voiced so far. The last
 * spoken word is the "active" one. `spaced` is false for languages written
 * without spaces (Japanese, Chinese, …) so the renderer can drop word gaps;
 * `rtl` is true for right-to-left scripts (Arabic, Hebrew, …).
 * See `TeacherPanel` for the rolling one-line render.
 */
export type SpeechCaption = {
  speaker: CaptionSpeaker;
  words: string[];
  spoken: number;
  spaced: boolean;
  rtl: boolean;
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
      const segmented = segmentText(text);
      if (segmented.words.length === 0) return;
      startWordReveal(
        { setCaption, captionTimerRef, clearCaptionTimer },
        segmented,
        segmented.words.length * ESTIMATED_WORD_SECONDS * 1000,
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

/** A sentence broken into display words, with each word's start char index. */
type SegmentedText = {
  words: string[];
  offsets: number[];
  spaced: boolean;
  rtl: boolean;
};

// Strong right-to-left scripts: Hebrew (+ presentation forms), Arabic
// (+ supplement / extended / presentation forms), Syriac, Thaana, NKo.
// Their presence flips the caption to RTL.
const RTL_PATTERN =
  /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u0780-\u07BF\u07C0-\u07FF\u0860-\u08FF\uFB1D-\uFB4F\uFB50-\uFDFF\uFE70-\uFEFF]/;

/** True when the text is written in a right-to-left script. */
function isRtlText(text: string): boolean {
  return RTL_PATTERN.test(text);
}

/**
 * Splits a sentence into caption words. Whitespace languages split on spaces;
 * languages written without spaces (Japanese, Chinese, …) are segmented with
 * `Intl.Segmenter` so the caption reveals and scrolls token-by-token instead
 * of as one unbreakable blob that overflows the strip.
 */
function segmentText(text: string): SegmentedText {
  const trimmed = text.trim();
  if (!trimmed) {
    return { words: [], offsets: [], spaced: true, rtl: false };
  }

  const rtl = isRtlText(trimmed);

  if (/\s/.test(trimmed)) {
    const words: string[] = [];
    const offsets: number[] = [];
    for (const match of trimmed.matchAll(/\S+/g)) {
      words.push(match[0]);
      offsets.push(match.index ?? 0);
    }
    return { words, offsets, spaced: true, rtl };
  }

  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    try {
      const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
      const words: string[] = [];
      const offsets: number[] = [];
      for (const part of segmenter.segment(trimmed)) {
        if (part.segment.trim()) {
          words.push(part.segment);
          offsets.push(part.index);
        }
      }
      if (words.length > 0) {
        return { words, offsets, spaced: false, rtl };
      }
    } catch {
      // Older browsers without Intl.Segmenter — fall through to the whole line.
    }
  }

  return { words: [trimmed], offsets: [0], spaced: false, rtl };
}

/**
 * Reveals the sentence one word at a time, pacing the reveal to fit `durationMs`
 * so the caption tracks the audio.
 */
function startWordReveal(
  { setCaption, captionTimerRef, clearCaptionTimer }: CaptionApi,
  { words, spaced, rtl }: SegmentedText,
  durationMs: number,
  speaker: CaptionSpeaker
): void {
  clearCaptionTimer();
  if (words.length === 0) {
    setCaption(null);
    return;
  }

  let spoken = 1;
  setCaption({ speaker, words, spoken, spaced, rtl });
  if (words.length === 1) {
    return;
  }

  const step = Math.max(140, durationMs / words.length);
  captionTimerRef.current = window.setInterval(() => {
    spoken += 1;
    setCaption({ speaker, words, spoken: Math.min(spoken, words.length), spaced, rtl });
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

    const segmented = segmentText(text);
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
          : segmented.words.length * ESTIMATED_WORD_SECONDS;
      startWordReveal(captionApi, segmented, seconds * 1000, "teacher");
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

    const segmented = segmentText(text);
    const { words, offsets, spaced, rtl } = segmented;
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
        segmented,
        words.length * ESTIMATED_WORD_SECONDS * 1000,
        "teacher"
      );
    };
    // Boundary events give exact word timing — far better than the estimate.
    utterance.onboundary = (event) => {
      if (event.name !== "word") return;
      const spoken = countWordsUpTo(offsets, event.charIndex);
      if (spoken > 0) {
        captionApi.clearCaptionTimer();
        captionApi.setCaption({
          speaker: "teacher",
          words,
          spoken: Math.min(spoken, words.length),
          spaced,
          rtl
        });
      }
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.speak(utterance);
  });
}

/** Counts how many words begin at or before `charIndex`. */
function countWordsUpTo(offsets: number[], charIndex: number): number {
  let count = 0;
  for (const offset of offsets) {
    if (offset <= charIndex) {
      count += 1;
    } else {
      break;
    }
  }
  return count;
}

function revokeBlobUrl(url: string): void {
  if (url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}
