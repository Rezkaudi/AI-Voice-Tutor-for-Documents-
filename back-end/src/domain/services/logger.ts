export interface Logger {
  info(message: string): void;
  warn(message: string, error?: unknown): void;
  error(message: string, error?: unknown): void;
  detail(label: string, body: string): void;
  preview(text: string, max?: number): string;
  scope(name: string): Logger;
}
