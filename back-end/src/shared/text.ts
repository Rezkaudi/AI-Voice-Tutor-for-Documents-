/** Collapses all whitespace runs to single spaces. */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
