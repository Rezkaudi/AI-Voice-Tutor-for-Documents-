import type { SpeechLanguage } from "@/types";
import { api, extractErrorMessage } from "@/services/apiBase";

/**
 * Speech-to-text transport. Talks to the backend's `/api/transcribe`.
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

  try {
    const { data } = await api.post<{ text?: string }>("/api/transcribe", formData, { signal });
    return typeof data.text === "string" ? data.text.trim() : "";
  } catch (error) {
    throw new Error(extractErrorMessage(error, "Transcription failed."), {
      cause: error
    });
  }
}
