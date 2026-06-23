import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "@/lib/uiClasses";

interface MenuItemProps {
  icon?: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  trailing?: React.ReactNode;
}

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
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-[0.82rem] font-semibold transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[oklch(0.82_0.13_165)]",
        danger
          ? "text-[oklch(0.84_0.1_32)] [&:hover:not(:disabled)]:bg-[oklch(0.3_0.07_30/0.6)]"
          : "text-[oklch(0.95_0.01_215)] [&:hover:not(:disabled)]:bg-[oklch(0.26_0.03_240/0.7)]",
        active && !danger && "bg-[oklch(0.24_0.03_240/0.55)]"
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

export function StateChip({ on }: { on: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      className={cx(
        "rounded-full px-1.5 py-0.5 text-[0.64rem] font-bold tracking-[0.02em]",
        on
          ? "bg-[oklch(0.82_0.13_165)] text-[oklch(0.18_0.04_230)]"
          : "bg-[oklch(0.3_0.025_240)] text-[oklch(0.78_0.02_215)]"
      )}
    >
      {on ? t("common.on") : t("common.off")}
    </span>
  );
}

export function MenuDivider() {
  return <div className="mx-2 my-1 h-px bg-[oklch(1_0_0/0.1)]" aria-hidden />;
}
