import type { ChatPayload } from "@/lib/types";
import {
  api,
  extractErrorMessage,
  isPaywallError,
  PaywallError
} from "@/services/apiBase";

/**
 * Tutor chat transport. Opens the streaming `/api/chat` SSE response.
 *
 * Uses axios's fetch adapter with responseType "stream" so we get the raw
 * ReadableStream — the default XHR adapter buffers the whole body.
 */
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
    // A 402 already raised the paywall — propagate a silent sentinel.
    if (isPaywallError(error)) throw new PaywallError();
    throw new Error(extractErrorMessage(error, "The teacher could not respond."), {
      cause: error
    });
  }
}
