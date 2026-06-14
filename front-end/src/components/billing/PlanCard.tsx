import { Check } from "lucide-react";
import { cx, ui } from "@/lib/uiClasses";

export interface PlanCardProps {
  icon: React.ReactNode;
  name: string;
  price: string;
  cadence: string;
  features: string[];
  cta: string;
  disabled: boolean;
  featured?: boolean;
  onClick: () => void;
}

export function PlanCard({
  icon,
  name,
  price,
  cadence,
  features,
  cta,
  disabled,
  featured = false,
  onClick
}: PlanCardProps) {
  return (
    <div
      className={cx(
        "flex flex-col gap-3 rounded-xl border bg-paper-strong p-4",
        featured
          ? "border-accent shadow-[0_8px_30px_oklch(0.18_0.03_244_/_0.12)]"
          : "border-line"
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cx(
            "grid h-9 w-9 place-items-center rounded-lg",
            featured
              ? "bg-accent text-[oklch(0.98_0.01_138)]"
              : "bg-paper text-ink"
          )}
        >
          {icon}
        </span>
        <div className="font-[760] text-ink">{name}</div>
        {featured ? (
          <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-wide text-[oklch(0.98_0.01_138)]">
            Popular
          </span>
        ) : null}
      </div>

      <div className="flex items-end gap-1">
        <span className="text-[2rem] font-bold leading-none text-ink tabular-nums">
          {price}
        </span>
        <span className="pb-1 text-[0.82rem] text-muted">{cadence}</span>
      </div>

      <ul className="m-0 flex flex-1 flex-col gap-1.5 p-0">
        {features.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-2 text-[0.85rem] text-muted"
          >
            <Check size={15} className="mt-0.5 flex-none text-accent" aria-hidden />
            {feature}
          </li>
        ))}
      </ul>

      <button
        type="button"
        className={cx(ui.button, featured && ui.buttonPrimary, "w-full")}
        disabled={disabled}
        onClick={onClick}
      >
        {cta}
      </button>
    </div>
  );
}
