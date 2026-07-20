import type { ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";

import { cx } from "@/lib/uiClasses";
import {
  chevron,
  langTrailing,
} from "@/styles/components/workspace/workspaceMenu";
import {
  workspaceMenuConfig,
  type WorkspaceMenuActionId,
  type WorkspaceMenuDisabledState,
  type WorkspaceMenuItemConfig,
  type WorkspaceMenuLabelKey,
  type WorkspaceMenuState,
} from "@/components/workspace/workspaceMenuConfig";

import { StateChip } from "./StateChip";

export type WorkspaceMenuActionMap = Record<
  WorkspaceMenuActionId,
  (() => void) | undefined
>;

type DesktopWorkspaceMenuItemEntry = {
  kind: "item" | "language";
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

export type DesktopWorkspaceMenuEntry =
  | DesktopWorkspaceMenuItemEntry
  | { kind: "divider"; id: string };

interface DesktopWorkspaceMenuEntriesInput {
  closeMenu: () => void;
  currentLangLabel: string;
  disabledState: WorkspaceMenuDisabledState;
  menuActions: WorkspaceMenuActionMap;
  menuState: WorkspaceMenuState;
  translate: (key: WorkspaceMenuLabelKey) => string;
}

export function buildDesktopWorkspaceMenuEntries({
  closeMenu,
  currentLangLabel,
  disabledState,
  menuActions,
  menuState,
  translate,
}: DesktopWorkspaceMenuEntriesInput): DesktopWorkspaceMenuEntry[] {
  const entries: DesktopWorkspaceMenuEntry[] = [];

  for (const entry of workspaceMenuConfig) {
    if (entry.kind === "divider") {
      entries.push(entry);
      continue;
    }

    const action = menuActions[entry.action];
    if (!action) continue;

    entries.push({
      kind: entry.trailing === "language" ? "language" : "item",
      id: entry.id,
      icon: entry.icon(menuState),
      label: translate(entry.labelKey(menuState)),
      active: entry.activeKey ? menuState[entry.activeKey] : undefined,
      danger: entry.danger,
      disabled: entry.disabledKey ? disabledState[entry.disabledKey] : undefined,
      expanded: entry.expandedKey ? menuState[entry.expandedKey] : undefined,
      trailing: renderTrailing(entry, menuState, currentLangLabel),
      onClick: () => {
        action();
        if (entry.closeOnSelect !== false) closeMenu();
      },
    });
  }

  return entries;
}

function renderTrailing(
  item: WorkspaceMenuItemConfig,
  menuState: WorkspaceMenuState,
  currentLangLabel: string,
) {
  if (item.stateChipKey) {
    return <StateChip on={menuState[item.stateChipKey]} />;
  }

  if (item.trailing !== "language") return undefined;

  return (
    <span className={langTrailing}>
      {!menuState.langOpen ? <span>{currentLangLabel}</span> : null}
      <ChevronDown
        size={14}
        aria-hidden
        className={cx(chevron, menuState.langOpen && "rotate-180")}
      />
    </span>
  );
}
