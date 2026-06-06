import type { Logger } from "@/domain/services/logger";

/**
 * A {@link Logger} that discards everything. Useful as a default in tests and
 * one-off scripts where log output is noise rather than signal.
 */
export class NullLogger implements Logger {
  info(): void {}
  warn(): void {}
  error(): void {}
  detail(): void {}
  scope(): Logger {
    return this;
  }
}
