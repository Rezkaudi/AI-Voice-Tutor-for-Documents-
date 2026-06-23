import { useEffect, useRef, useState } from "react";
import { Check, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx, ui } from "@/lib/uiClasses";
import { LANGUAGES } from "@/i18n/config";

interface LanguageSwitcherProps {
  className?: string;
}

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const current = i18n.resolvedLanguage ?? i18n.language;
  const activeLabel =
    LANGUAGES.find((l) => l.code === current)?.label ?? current.toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const trigger = cx(
    "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[0.82rem] font-semibold transition-colors duration-150 ease-out",
    ui.focusAccent,
    "border-line bg-paper-strong text-ink [&:hover:not(:disabled)]:border-accent"
  );

  return (
    <div ref={rootRef} className={cx("relative", className)}>
      <button
        type="button"
        className={trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("language.switch")}
        title={t("language.switch")}
        onClick={() => setOpen((value) => !value)}
      >
        <Globe size={16} aria-hidden />
        <span>{activeLabel}</span>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={t("language.switch")}
          className="absolute end-0 top-11 z-50 w-44 origin-top overflow-hidden rounded-xl border border-line bg-paper-strong p-1 shadow-app animate-modal-pop"
        >
          {LANGUAGES.map((lang) => {
            const active = lang.code === current;
            return (
              <button
                key={lang.code}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                lang={lang.code}
                dir="ltr"
                className={cx(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-start text-[0.88rem] font-semibold transition-colors duration-150 ease-out",
                  ui.focusAccent,
                  active
                    ? "bg-[oklch(0.95_0.04_154)] text-accent-ink"
                    : "text-ink [&:hover]:bg-[oklch(0.93_0.014_240)]"
                )}
                onClick={() => {
                  void i18n.changeLanguage(lang.code);
                  setOpen(false);
                }}
              >
                <span>{lang.label}</span>
                {active ? <Check size={16} className="flex-none text-accent" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
