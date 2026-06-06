import type { Logger } from "@/domain/services/logger";
import { logger as sink, block } from "@/shared/logger";

/**
 * Console-backed {@link Logger}.
 *
 * Verbosity is fixed at construction (from `TUTOR_LOG_VERBOSE`, set in the
 * composition root), so `detail` is a no-op on every instance when tracing is
 * off. {@link scope} returns a child that tags each line `[name id]` with a
 * fresh correlation id, letting the interleaved lines of concurrent requests
 * be told apart while inheriting the same verbosity.
 */
export class ConsoleLogger implements Logger {
  constructor(
    private readonly verbose: boolean,
    private readonly tag = ""
  ) {}

  info(message: string): void {
    sink.info(this.format(message));
  }

  warn(message: string): void {
    sink.warn(this.format(message));
  }

  error(message: string, error?: unknown): void {
    sink.error(this.format(message), error);
  }

  detail(label: string, body: string): void {
    if (!this.verbose) return;
    sink.info(this.format(`↳ ${label}:`), `\n${block(body)}`);
  }

  scope(name: string): Logger {
    const id = Math.random().toString(36).slice(2, 8);
    return new ConsoleLogger(this.verbose, `[${name} ${id}]`);
  }

  private format(message: string): string {
    return this.tag ? `${this.tag} ${message}` : message;
  }
}
