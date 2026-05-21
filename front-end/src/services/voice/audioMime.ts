const AUDIO_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4"
];

/** Picks the first MediaRecorder MIME the browser actually supports. */
export function pickAudioMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return (
    AUDIO_MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported?.(type)) ?? null
  );
}
