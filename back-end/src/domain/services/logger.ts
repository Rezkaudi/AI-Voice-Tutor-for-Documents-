/**
 * Logging boundary (port).
 *
 * A cross-cutting concern the application core depends on as an abstraction:
 * use cases and domain services log through this interface and never know
 * whether the sink is the console, pino, or a test double. The concrete
 * adapter lives in infrastructure and is wired in the composition root.
 */
export interface Logger {
  /** A step in the normal narrative of an operation. Always emitted. */
  info(message: string): void;
  /** A recoverable problem or rejected request. Always emitted. */
  warn(message: string): void;
  /** A failure. The optional cause is rendered alongside the message. */
  error(message: string, error?: unknown): void;
  /**
   * A full payload dump (tool output, an answer, a transcript) for deep
   * tracing. Suppressed unless verbose logging is enabled, so it is safe to
   * call on hot paths.
   */
  detail(label: string, body: string): void;
  /**
   * Derives a logger that tags every line with `name` and a fresh correlation
   * id. Call once per operation (e.g. at the top of a use case) so the
   * interleaved lines of concurrent requests stay legible.
   */
  scope(name: string): Logger;
}
