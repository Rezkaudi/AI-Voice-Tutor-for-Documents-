import type { SpeechLanguage } from "@/lib/types";

/**
 * Speech-to-text transport. Talks to the original backend's `/api/transcribe`.
 */

/**
 * Uploads a recorded clip and returns the transcribed text.
 *
 * @param {Blob} blob
 * @param {string} [language]
 * @param {AbortSignal} [signal]
 * @returns {Promise<string>}
 */
export async function transcribeRecording(
  blob: Blob,
  language?: SpeechLanguage,
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
  const data = (await response.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!response.ok) {
    throw new Error(data.error || "Transcription failed.");
  }
  return typeof data.text === "string" ? data.text.trim() : "";
}
