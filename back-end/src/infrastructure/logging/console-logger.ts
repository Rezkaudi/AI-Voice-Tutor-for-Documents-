import type { Logger } from "@/domain/services/logger";

type Level = "info" | "warn" | "error";

export class ConsoleLogger implements Logger {
  constructor(
    private readonly verbose: boolean,
    private readonly tag = ""
  ) { }

  info(message: string): void {
    this.emit("info", this.format(message));
  }

  warn(message: string, error?: unknown): void {
    this.emit("warn", this.format(message), error);
  }

  error(message: string, error?: unknown): void {
    this.emit("error", this.format(message), error);
  }

  detail(label: string, body: string): void {
    if (!this.verbose) return;
    this.emit("info", this.format(`↳ ${label}:`), `\n${this.block(body)}`);
  }

  preview(text: string, max = 120): string {
    const collapsed = text.replace(/\s+/g, " ").trim();
    return collapsed.length > max ? `${collapsed.slice(0, max)}…` : collapsed;
  }

  scope(name: string): Logger {
    const id = Math.random().toString(36).slice(2, 8);
    return new ConsoleLogger(this.verbose, `[${name} ${id}]`);
  }

  private format(message: string): string {
    return this.tag ? `${this.tag} ${message}` : message;
  }

  private block(body: string, max = 16000): string {
    const text =
      body.length > max
        ? `${body.slice(0, max)}\n… (${body.length - max} more characters truncated)`
        : body;
    return text
      .split("\n")
      .map((line) => `    ${line}`)
      .join("\n");
  }

  private emit(level: Level, message: string, meta?: unknown): void {
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
}
