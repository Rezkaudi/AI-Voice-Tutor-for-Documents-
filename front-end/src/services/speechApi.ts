/**
 * Text-to-speech transport. Talks to the original backend's `/api/speak`.
 */

/**
 * Synthesizes one sentence. Resolves to an audio `Blob`, or `null` when the
 * server has no TTS configured — the caller then falls back to browser speech.
 *
 * @param {string} text
 * @param {AbortSignal} [signal]
 * @returns {Promise<Blob | null>}
 */
export function fetchSpeechClip(text: string, signal?: AbortSignal): Promise<Blob | null> {
  return fetch("/api/speak", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
    signal
  })
    .then((response) => (response.ok ? response.blob() : null))
    .catch(() => null);
}
