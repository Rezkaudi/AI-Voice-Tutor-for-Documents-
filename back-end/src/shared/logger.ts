/**
 * Tiny structured logger. Deliberately dependency-free — swap the body for
 * pino/winston later without touching call sites.
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
}

export const logger = {
  info: (message: string, meta?: unknown) => emit("info", message, meta),
  warn: (message: string, meta?: unknown) => emit("warn", message, meta),
  error: (message: string, meta?: unknown) => emit("error", message, meta)
};
