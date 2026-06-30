import { SPEECH_LANGUAGES } from "@/lib/constants";
import { cx } from "@/lib/uiClasses";
import type { SpeechLanguage } from "@/types";
import { langOptionActive, langOptionBase } from "./styles";

interface LanguagePickerProps {
  value: SpeechLanguage;
  disabled: boolean;
  onChange: (language: SpeechLanguage) => void;
}

export function LanguagePicker({ value, disabled, onChange }: LanguagePickerProps) {
  return (
    <div className="mt-3 flex flex-col items-center gap-1.5">
      <span
        className="text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-[oklch(0.66_0.02_215)]"
        id="lang-picker-label"
      >
        I speak
      </span>
      <div
        className="inline-flex max-w-full flex-nowrap justify-start gap-0.5 overflow-x-auto rounded-full border border-[oklch(0.4_0.03_220/0.7)] bg-[oklch(0.22_0.03_230)] p-[3px] scrollbar-none [&::-webkit-scrollbar]:hidden"
        role="radiogroup"
        aria-labelledby="lang-picker-label"
      >
        {SPEECH_LANGUAGES.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value || "auto"}
              type="button"
              role="radio"
              aria-checked={active}
              className={cx(langOptionBase, active && langOptionActive)}
              onClick={() => onChange(option.value)}
              disabled={disabled}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
