import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type SettingsMenuItemEntry = {
  kind: "item";
  id: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  trailing?: ReactNode;
};

export type SettingsMenuEntry =
  | SettingsMenuItemEntry
  | { kind: "divider"; id: string }
  | { kind: "language"; id: string };
