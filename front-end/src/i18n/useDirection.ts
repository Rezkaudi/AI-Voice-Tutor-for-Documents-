import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { directionOf } from "./config";

export function useDirection(): void {
  const { i18n } = useTranslation();

  useEffect(() => {
    const apply = (lng: string) => {
      const root = document.documentElement;
      root.lang = lng;
      root.dir = directionOf(lng);
    };

    apply(i18n.resolvedLanguage ?? i18n.language);
    i18n.on("languageChanged", apply);
    return () => i18n.off("languageChanged", apply);
  }, [i18n]);
}
