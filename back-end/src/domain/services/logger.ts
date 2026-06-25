export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string, error?: unknown): void;
  detail(label: string, body: string): void;
  scope(name: string): Logger;
}
