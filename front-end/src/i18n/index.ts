import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from "./config";
import en from "./locales/en/common.json";
import ar from "./locales/ar/common.json";
import ja from "./locales/ja/common.json";

export const defaultNS = "common";

export const resources = {
  en: { common: en },
  ar: { common: ar },
  ja: { common: ja }
} as const;

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    defaultNS,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
      lookupLocalStorage: "i18nextLng"
    },
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
