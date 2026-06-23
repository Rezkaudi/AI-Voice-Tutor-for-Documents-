import { useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "@/lib/uiClasses";
import { LANGUAGES } from "@/i18n/config";
import { MenuItem } from "./MenuItem";

interface LanguageMenuProps {
  onSelect: () => void;
}

export function LanguageMenu({ onSelect }: LanguageMenuProps) {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.resolvedLanguage ?? i18n.language;
  const currentLangLabel = LANGUAGES.find((l) => l.code === currentLang)?.label ?? currentLang;
  const [open, setOpen] = useState(false);

  return (
    <>
      <MenuItem
        icon={Globe}
        label={t("language.label")}
        active={open}
        expanded={open}
        onClick={() => setOpen((v) => !v)}
        trailing={
          <span className="flex items-center gap-1.5 text-[0.74rem] font-semibold text-[oklch(0.78_0.02_215)]">
            {!open ? <span>{currentLangLabel}</span> : null}
            <ChevronDown
              size={14}
              aria-hidden
              className={cx("transition-transform duration-200 ease-out", open && "rotate-180")}
            />
          </span>
        }
      />
      {open ? (
        <div
          className="mb-0.5 ms-7 me-0.5 mt-0.5 flex origin-top flex-col gap-0.5 rounded-lg border border-[oklch(1_0_0/0.08)] bg-[oklch(0.2_0.025_242/0.6)] p-1 animate-submenu"
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
                  "flex min-h-9 w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-start text-[0.82rem] font-semibold transition-colors duration-150 ease-out",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[oklch(0.82_0.13_165)]",
                  active
                    ? "bg-[oklch(0.82_0.13_165)] text-[oklch(0.18_0.04_230)]"
                    : "text-[oklch(0.92_0.01_215)] [&:hover]:bg-[oklch(0.27_0.03_240/0.7)]"
                )}
                onClick={() => {
                  void i18n.changeLanguage(lang.code);
                  onSelect();
                }}
              >
                <span>{lang.label}</span>
                {active ? (
                  <Check size={15} className="flex-none text-[oklch(0.2_0.04_230)]" aria-hidden />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
