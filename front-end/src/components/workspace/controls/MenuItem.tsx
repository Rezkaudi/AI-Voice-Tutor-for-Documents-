import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "@/lib/uiClasses";
import {
  menuDivider,
  menuItemActive,
  menuItemBase,
  menuItemDanger,
  menuItemDefault,
  stateChipBase,
  stateChipOff,
  stateChipOn
} from "@/styles/components/workspace/controls/menuItem";

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
        menuItemBase,
        danger ? menuItemDanger : menuItemDefault,
        active && !danger && menuItemActive
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
    <span className={cx(stateChipBase, on ? stateChipOn : stateChipOff)}>
      {on ? t("common.on") : t("common.off")}
    </span>
  );
}

export function MenuDivider() {
  return <div className={menuDivider} aria-hidden />;
}
