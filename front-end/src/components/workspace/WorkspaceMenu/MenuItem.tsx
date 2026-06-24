import { type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cx } from "@/lib/uiClasses";

interface MenuItemProps {
  icon?: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  trailing?: ReactNode;
}

/** One labelled row in the workspace overflow menu. */
export function MenuItem({
  icon: Icon,
  label,
  onClick,
  active = false,
  danger = false,
  disabled = false,
  expanded,
  trailing
}: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cx(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-[0.85rem] font-semibold transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
        danger
          ? "text-danger [&:hover:not(:disabled)]:bg-[oklch(0.94_0.04_28)]"
          : "text-ink [&:hover:not(:disabled)]:bg-[oklch(0.93_0.014_240)]",
        active && !danger && "bg-[oklch(0.95_0.04_154)] text-accent-ink"
      )}
      aria-pressed={expanded === undefined ? active : undefined}
      aria-expanded={expanded}
      onClick={onClick}
      disabled={disabled}
    >
      {Icon ? (
        <Icon size={16} aria-hidden className="flex-none" />
      ) : (
        <span className="w-4 flex-none" aria-hidden />
      )}
      <span className="flex-1">{label}</span>
      {trailing}
    </button>
  );
}
