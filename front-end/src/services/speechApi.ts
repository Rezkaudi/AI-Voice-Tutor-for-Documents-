import { api } from "@/services/apiBase";

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
