export const LANGUAGES = [
  { code: "en", label: "English", dir: "ltr" },
  { code: "ar", label: "العربية", dir: "rtl" },
  { code: "ja", label: "日本語", dir: "ltr" }
] as const;

export type AppLanguage = (typeof LANGUAGES)[number]["code"];

export const SUPPORTED_LANGUAGES = LANGUAGES.map((l) => l.code);

export const DEFAULT_LANGUAGE: AppLanguage = "en";

export function directionOf(code: string): "ltr" | "rtl" {
  return LANGUAGES.find((l) => l.code === code)?.dir ?? "ltr";
}
