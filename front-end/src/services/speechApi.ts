import { api } from "@/services/apiBase";

/**
 * Text-to-speech transport. Talks to the backend's `/api/speak`.
 *
 * Resolves to an audio Blob, or null when the server has no TTS configured —
 * the caller then falls back to browser speech.
 */
export async function fetchSpeechClip(
  text: string,
  signal?: AbortSignal
): Promise<Blob | null> {
  try {
    const { data } = await api.post<Blob>(
      "/api/speak",
      { text },
      { responseType: "blob", signal }
    );
    return data;
  } catch {
    return null;
  }
}
