import { useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "@/lib/uiClasses";
import { LANGUAGES } from "@/i18n/config";
import {
  chevron,
  langCheck,
  langOptionActive,
  langOptionBase,
  langOptionIdle,
  submenu,
  trailing
} from "@/styles/components/workspace/controls/languageMenu";
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
          <span className={trailing}>
            {!open ? <span>{currentLangLabel}</span> : null}
            <ChevronDown
              size={14}
              aria-hidden
              className={cx(chevron, open && "rotate-180")}
            />
          </span>
        }
      />
      {open ? (
        <div className={submenu} role="group" aria-label={t("language.label")}>
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
                className={cx(langOptionBase, active ? langOptionActive : langOptionIdle)}
                onClick={() => {
                  void i18n.changeLanguage(lang.code);
                  onSelect();
                }}
              >
                <span>{lang.label}</span>
                {active ? <Check size={15} className={langCheck} aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
