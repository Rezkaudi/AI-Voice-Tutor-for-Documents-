import { useCallback, useEffect, useRef, useState } from "react";
import { MicVAD, utils } from "@ricky0123/vad-web";

/**
 * Browser microphone permission state. `denied` means the user blocked it —
 * the browser will never re-prompt; the user must re-enable it in site
 * settings. `unknown` means the Permissions API could not report it.
 */
export type MicPermission = "unknown" | "prompt" | "granted" | "denied";

export type VoiceConversation = {
  isSupported: boolean;
  /** Live permission state; updates automatically when the user changes it. */
  permission: MicPermission;
  /** The mic is open and the VAD is actively listening for the student. */
  isListening: boolean;
  /** The VAD model is still downloading/initialising after the first `start()`. */
  isConnecting: boolean;
  /** The student is currently speaking (between speech-start and speech-end). */
  isUserSpeaking: boolean;
  /** A finished utterance is being transcribed. */
  isTranscribing: boolean;
  /** Probes mic access without starting the VAD. Resolves to the grant result. */
  requestPermission: () => Promise<boolean>;
  /** Boots the VAD (first call downloads the model) and begins listening. */
  start: () => Promise<void>;
  /** Tears the VAD down and releases the microphone. */
  stop: () => void;
  /** Temporarily stops listening without releasing the mic (mute). */
  pause: () => void;
  /** Resumes listening after `pause()`. */
  resume: () => Promise<void>;
};

type Params = {
  /** Receives the transcript of each finished student utterance. */
  onTranscript: (transcript: string) => void;
  onError: (message: string) => void;
  /**
   * Fires the instant the student starts speaking — used to barge in on the
   * teacher (stop playback / abort the in-flight answer).
   */
  onSpeechStart: () => void;
  /** Read lazily so the latest UI language selection is used at upload time. */
  getLanguage?: () => string | undefined;
};

// Silero VAD tuning. The thresholds are the library defaults; the timings are
// widened so the tutor waits for a natural pause instead of cutting the student
// off mid-thought, and ignores momentary clicks/coughs.
const VAD_TUNING = {
  positiveSpeechThreshold: 0.5,
  negativeSpeechThreshold: 0.35,
  // Silence held this long ends the turn and submits the utterance.
  redemptionMs: 960,
  // Utterances shorter than this are treated as noise (onVADMisfire).
  minSpeechMs: 250,
  // Audio kept before the detected speech start, so no leading word is clipped.
  preSpeechPadMs: 800
} as const;

/**
 * Hands-free voice loop for the tutor call. A Silero VAD model runs in the
 * browser and listens continuously: it detects when the student starts and
 * stops talking on its own, so there is no record/send button. Each finished
 * utterance is transcribed and handed back via `onTranscript`; `onSpeechStart`
 * lets the caller barge in on the teacher the moment the student speaks.
 */
export function useVoiceConversation({
  onTranscript,
  onError,
  onSpeechStart,
  getLanguage
}: Params): VoiceConversation {
  const [isSupported, setIsSupported] = useState(true);
  const [permission, setPermission] = useState<MicPermission>("unknown");
  const [isListening, setIsListening] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const vadRef = useRef<MicVAD | null>(null);
  // Every in-flight transcription, so `stop()` can abort them all at once.
  const transcribeControllersRef = useRef<Set<AbortController>>(new Set());

  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);
  const onSpeechStartRef = useRef(onSpeechStart);
  const getLanguageRef = useRef(getLanguage);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onErrorRef.current = onError;
    onSpeechStartRef.current = onSpeechStart;
    getLanguageRef.current = getLanguage;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsSupported(
      !!navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === "function" &&
        typeof window.AudioContext !== "undefined"
    );
  }, []);

  // Track the live permission state so the UI can recover the moment the user
  // re-enables a previously blocked mic in their browser settings.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) {
      return;
    }
    let status: PermissionStatus | null = null;
    let cancelled = false;
    navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((result) => {
        if (cancelled) return;
        status = result;
        setPermission(result.state as MicPermission);
        result.onchange = () => setPermission(result.state as MicPermission);
      })
      .catch(() => {
        // Firefox/Safari may not expose "microphone" — leave it "unknown".
      });
    return () => {
      cancelled = true;
      if (status) status.onchange = null;
    };
  }, []);

  const handleSpeechEnd = useCallback(async (audio: Float32Array) => {
    setIsUserSpeaking(false);

    // `audio` is 16 kHz mono PCM — wrap it as a WAV file for the transcriber.
    const wav = utils.encodeWAV(audio);
    const blob = new Blob([wav], { type: "audio/wav" });

    const controller = new AbortController();
    transcribeControllersRef.current.add(controller);
    setIsTranscribing(true);
    try {
      const text = await transcribeRecording(
        blob,
        getLanguageRef.current?.(),
        controller.signal
      );
      if (text) {
        onTranscriptRef.current(text);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        onErrorRef.current(
          error instanceof Error ? error.message : "Transcription failed."
        );
      }
    } finally {
      transcribeControllersRef.current.delete(controller);
      if (transcribeControllersRef.current.size === 0) {
        setIsTranscribing(false);
      }
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      onErrorRef.current("Microphone is not supported in this browser.");
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Only probing the grant here — release the device immediately.
      stream.getTracks().forEach((track) => track.stop());
      setPermission("granted");
      return true;
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        // The blocked-mic popup explains this — skip the inline error bubble.
        setPermission("denied");
        return false;
      }
      if (name === "NotFoundError" || name === "OverconstrainedError") {
        onErrorRef.current("No microphone was found. Connect one and try again.");
      } else {
        onErrorRef.current(
          error instanceof Error ? error.message : "Could not start the microphone."
        );
      }
      return false;
    }
  }, [isSupported]);

  const start = useCallback(async () => {
    if (!isSupported) {
      onErrorRef.current("Microphone is not supported in this browser.");
      return;
    }
    // Already booted (e.g. resuming after a mute) — just listen again.
    if (vadRef.current) {
      await vadRef.current.start();
      setIsListening(true);
      return;
    }

    setIsConnecting(true);
    try {
      const vad = await MicVAD.new({
        model: "v5",
        // VAD worklet + Silero ONNX model, copied into public/vad/ at install.
        baseAssetPath: "/vad/",
        // onnxruntime-web WASM binaries, copied into the same folder.
        onnxWASMBasePath: "/vad/",
        ...VAD_TUNING,
        onSpeechStart: () => {
          setIsUserSpeaking(true);
          onSpeechStartRef.current();
        },
        onVADMisfire: () => setIsUserSpeaking(false),
        onSpeechEnd: handleSpeechEnd
      });
      vadRef.current = vad;
      setPermission("granted");
      await vad.start();
      setIsListening(true);
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setPermission("denied");
      } else {
        onErrorRef.current(
          error instanceof Error ? error.message : "Could not start the microphone."
        );
      }
    } finally {
      setIsConnecting(false);
    }
  }, [handleSpeechEnd, isSupported]);

  const stop = useCallback(() => {
    transcribeControllersRef.current.forEach((controller) => controller.abort());
    transcribeControllersRef.current.clear();
    const vad = vadRef.current;
    vadRef.current = null;
    // destroy() releases the mic stream and tears down the audio graph.
    void vad?.destroy();
    setIsListening(false);
    setIsUserSpeaking(false);
    setIsTranscribing(false);
  }, []);

  const pause = useCallback(() => {
    void vadRef.current?.pause();
    setIsListening(false);
    setIsUserSpeaking(false);
  }, []);

  const resume = useCallback(async () => {
    if (!vadRef.current) return;
    await vadRef.current.start();
    setIsListening(true);
  }, []);

  useEffect(() => {
    return () => {
      transcribeControllersRef.current.forEach((controller) => controller.abort());
      void vadRef.current?.destroy();
      vadRef.current = null;
    };
  }, []);

  return {
    isSupported,
    permission,
    isListening,
    isConnecting,
    isUserSpeaking,
    isTranscribing,
    requestPermission,
    start,
    stop,
    pause,
    resume
  };
}

async function transcribeRecording(
  blob: Blob,
  language?: string,
  signal?: AbortSignal
): Promise<string> {
  const formData = new FormData();
  formData.append("audio", new File([blob], "speech.wav", { type: "audio/wav" }));
  if (language) {
    formData.append("language", language);
  }

  const response = await fetch("/api/transcribe", {
    method: "POST",
    body: formData,
    signal
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Transcription failed.");
  }
  return typeof data.text === "string" ? data.text.trim() : "";
}
