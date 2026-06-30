import type { ChatPayload } from "@/types";
import { api, extractErrorMessage } from "@/services/apiBase";

export async function streamChat(
  payload: ChatPayload,
  signal: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
  try {
    const response = await api.post<ReadableStream<Uint8Array>>("/api/chat", payload, {
      headers: { "content-type": "application/json" },
      adapter: "fetch",
      responseType: "stream",
      signal
    });

    if (!response.data) {
      throw new Error("The teacher could not respond.");
    }
    return response.data;
  } catch (error) {
    throw new Error(extractErrorMessage(error, "The teacher could not respond."), {
      cause: error
    });
  }
}
