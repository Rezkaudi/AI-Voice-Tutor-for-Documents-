/**
 * Raw, dependency-free log sink and formatting helpers.
 *
 * This is the lowest level: a timestamped writer to the console, plus two text
 * utilities. The application core never imports this directly — it depends on
 * the {@link "@/domain/services/logger".Logger} port, whose console adapter is
 * built on top of these. Bootstrap and HTTP middleware (pure infrastructure)
 * may use the flat `logger` where dependency injection isn't yet available.
 *
 * Swap the body of `emit` for pino/winston later without touching call sites.
 */

type Level = "info" | "warn" | "error";

function emit(level: Level, message: string, meta?: unknown): void {
  const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${message}`;
  const sink = level === "error" ? console.error : console.log;
  if (meta instanceof Error) {
    sink(line, "\n", meta.stack ?? meta.message);
  } else if (meta !== undefined) {
    sink(line, meta);
  } else {
    sink(line);
  }
  // Blank line between entries so a busy log stays scannable.
  sink("");
}

export const logger = {
  info: (message: string, meta?: unknown) => emit("info", message, meta),
  warn: (message: string, meta?: unknown) => emit("warn", message, meta),
  error: (message: string, meta?: unknown) => emit("error", message, meta)
};

/** Collapses whitespace and clips to `max` chars for a single-line log preview. */
export function truncate(text: string, max = 120): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > max ? `${collapsed.slice(0, max)}…` : collapsed;
}

/**
 * Indents a (possibly multi-line) value into a readable block for verbose logs,
 * clipping pathologically large bodies so a single trace can't flood the console.
 */
export function block(body: string, max = 16000): string {
  const text =
    body.length > max
      ? `${body.slice(0, max)}\n… (${body.length - max} more characters truncated)`
      : body;
  return text
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");
}
