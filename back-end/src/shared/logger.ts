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
  sink("");
}

export const logger = {
  info: (message: string, meta?: unknown) => emit("info", message, meta),
  warn: (message: string, meta?: unknown) => emit("warn", message, meta),
  error: (message: string, meta?: unknown) => emit("error", message, meta)
};

export function truncate(text: string, max = 120): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > max ? `${collapsed.slice(0, max)}…` : collapsed;
}

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
