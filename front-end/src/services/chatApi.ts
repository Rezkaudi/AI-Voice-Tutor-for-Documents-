import type { ChatPayload } from "@/lib/types";

/**
 * Tutor chat transport. Opens the streaming `/api/chat` SSE response.
 */

/**
 * Starts a tutor answer stream and returns the raw SSE body for the caller to
 * read with `readEventStream`. Throws with the server's message on failure.
 *
 * @param {object} payload
 * @param {AbortSignal} signal
 * @returns {Promise<ReadableStream<Uint8Array>>}
 */
export async function streamChat(
  payload: ChatPayload,
  signal: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal
  });

  if (!response.ok || !response.body) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "The teacher could not respond.");
  }

  return response.body;
}
