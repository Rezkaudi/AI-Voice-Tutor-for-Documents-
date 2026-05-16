import { useCallback, useEffect, useRef, useState } from "react";

const AUDIO_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4"
];

/**
 * Browser microphone permission state. `denied` means the user blocked it —
 * the browser will never re-prompt; the user must re-enable it in site
 * settings. `unknown` means the Permissions API could not report it.
 */
export type MicPermission = "unknown" | "prompt" | "granted" | "denied";

export type VoiceRecorder = {
  isListening: boolean;
  isTranscribing: boolean;
  isSupported: boolean;
  /** Live permission state; updates automatically when the user changes it. */
  permission: MicPermission;
  /**
   * Asks the browser for mic access. Shows the native prompt when the state is
   * still `prompt`; when already `denied` it can only succeed if the user has
   * re-enabled the mic in site settings. Resolves to the resulting grant.
   */
  requestPermission: () => Promise<boolean>;
  start: () => Promise<void>;
  stop: () => void;
  /** Stops recording and aborts any in-flight transcription without sending it. */
  cancel: () => void;
};

/**
 * Records a single microphone clip, uploads it for transcription, and reports
 * the resulting text. `getLanguage` is read lazily so the latest UI selection
 * is used at upload time.
 */
export function useVoiceRecorder(
  onTranscript: (transcript: string) => void,
  onError: (message: string) => void,
  getLanguage?: () => string | undefined
): VoiceRecorder {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [permission, setPermission] = useState<MicPermission>("unknown");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const transcribeAbortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsSupported(
      typeof window.MediaRecorder !== "undefined" &&
        !!navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === "function"
    );
  }, []);

  // Track the live permission state. The `onchange` handler is what lets the
  // UI recover the moment the user re-enables a previously blocked mic in
  // their browser site settings — no page reload required.
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

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      onErrorRef.current("Microphone recording is not supported in this browser.");
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
      onErrorRef.current(describeRecorderError(error));
      return false;
    }
  }, [isSupported]);

  const start = useCallback(async () => {
    if (!isSupported) {
      onErrorRef.current("Microphone recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setPermission("granted");
      const mimeType = pickAudioMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        onErrorRef.current("Recording failed. Check your microphone and try again.");
        cleanupStream();
        setIsListening(false);
      };

      recorder.onstop = async () => {
        const chunks = chunksRef.current;
        chunksRef.current = [];
        cleanupStream();
        if (chunks.length === 0 || cancelledRef.current) {
          setIsListening(false);
          return;
        }

        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        setIsListening(false);
        setIsTranscribing(true);
        const controller = new AbortController();
        transcribeAbortRef.current = controller;
        try {
          const text = await transcribeRecording(blob, getLanguage?.(), controller.signal);
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
          if (transcribeAbortRef.current === controller) {
            transcribeAbortRef.current = null;
          }
          setIsTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      cancelledRef.current = false;
      recorder.start();
      setIsListening(true);
    } catch (error) {
      cleanupStream();
      // Browsers without the Permissions API only reveal a block here.
      const name = error instanceof Error ? error.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        // The blocked-mic popup explains this — skip the inline error bubble.
        setPermission("denied");
        return;
      }
      onErrorRef.current(describeRecorderError(error));
    }
  }, [cleanupStream, getLanguage, isSupported]);

  const stop = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      cleanupStream();
      setIsListening(false);
    }
  }, [cleanupStream]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    transcribeAbortRef.current?.abort();
    transcribeAbortRef.current = null;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      cleanupStream();
    }
    setIsListening(false);
    setIsTranscribing(false);
  }, [cleanupStream]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      cleanupStream();
    };
  }, [cleanupStream]);

  return {
    isListening,
    isTranscribing,
    isSupported,
    permission,
    requestPermission,
    start,
    stop,
    cancel
  };
}

function pickAudioMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") {
    return null;
  }
  return AUDIO_MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported?.(type)) ?? null;
}

function describeRecorderError(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No microphone was found. Connect one and try again.";
  }
  return error instanceof Error ? error.message : "Could not start the microphone.";
}

async function transcribeRecording(
  blob: Blob,
  language?: string,
  signal?: AbortSignal
): Promise<string> {
  const extension = blob.type.includes("ogg")
    ? "ogg"
    : blob.type.includes("mp4")
      ? "m4a"
      : "webm";

  const formData = new FormData();
  formData.append(
    "audio",
    new File([blob], `recording.${extension}`, { type: blob.type || "audio/webm" })
  );
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
