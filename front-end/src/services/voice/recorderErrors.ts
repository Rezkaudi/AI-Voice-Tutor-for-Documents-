/** Maps a MediaRecorder/getUserMedia error to a user-friendly message. */
export function describeRecorderError(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No microphone was found. Connect one and try again.";
  }
  return error instanceof Error ? error.message : "Could not start the microphone.";
}

/** True for the two errors browsers raise when the mic is blocked. */
export function isPermissionDenied(error: unknown): boolean {
  const name = error instanceof Error ? error.name : "";
  return name === "NotAllowedError" || name === "SecurityError";
}

/** True when this browser can record audio at all. */
export function isMediaRecorderSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.MediaRecorder !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );
}
