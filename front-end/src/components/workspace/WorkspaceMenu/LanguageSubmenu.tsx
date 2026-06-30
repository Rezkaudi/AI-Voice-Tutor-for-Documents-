import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "@/lib/uiClasses";
import { LANGUAGES } from "@/i18n/config";

interface LanguageSubmenuProps {
  currentLang: string;

  onSelect: (action: () => void) => void;
}

export function LanguageSubmenu({ currentLang, onSelect }: LanguageSubmenuProps) {
  const { t, i18n } = useTranslation();
  return (
    <div
      className="mb-0.5 ms-7 me-0.5 mt-0.5 flex origin-top flex-col gap-0.5 rounded-lg border border-line bg-[oklch(0.97_0.006_240)] p-1 animate-submenu"
      role="group"
      aria-label={t("language.label")}
    >
      {LANGUAGES.map((lang) => {
        const active = lang.code === currentLang;
        return (
          <button
            key={lang.code}
            type="button"
            role="menuitemradio"
            aria-checked={active}
            lang={lang.code}
            dir="ltr"
            className={cx(
              "flex min-h-9 w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-start text-[0.84rem] font-semibold transition-colors duration-150 ease-out",
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
              active
                ? "bg-paper-strong text-accent-ink shadow-app"
                : "text-ink [&:hover]:bg-[oklch(0.94_0.012_240)]"
            )}
            onClick={() => onSelect(() => void i18n.changeLanguage(lang.code))}
          >
            <span>{lang.label}</span>
            {active ? <Check size={15} className="flex-none text-accent" aria-hidden /> : null}
          </button>
        );
      })}
    </div>
  );
}
