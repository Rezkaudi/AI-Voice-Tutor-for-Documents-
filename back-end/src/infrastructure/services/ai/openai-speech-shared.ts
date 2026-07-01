const CHARS_PER_TOKEN = 4;

export const AUDIO_TOKENS_PER_TEXT_TOKEN = 6;

export const estimateTokens = (text: string): number => Math.ceil(text.length / CHARS_PER_TOKEN);

export function describe(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
