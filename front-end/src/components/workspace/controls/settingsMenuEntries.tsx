import {
  workspaceMenuConfig,
  type WorkspaceMenuActionMap,
  type WorkspaceMenuDisabledState,
  type WorkspaceMenuItemConfig,
  type WorkspaceMenuLabelKey,
  type WorkspaceMenuState,
} from "@/components/workspace/workspaceMenuConfig";

import { StateChip } from "./MenuItem";
import {
  settingsMenuLayout,
  stateChipActions,
  stayOpenActions,
} from "./settingsMenuPolicy";
import type { SettingsMenuEntry } from "./settingsMenuTypes";

interface SettingsMenuEntriesInput {
  closeMenu: () => void;
  disabledState: WorkspaceMenuDisabledState;
  menuActions: WorkspaceMenuActionMap;
  menuState: WorkspaceMenuState;
  translate: (key: WorkspaceMenuLabelKey) => string;
}

const itemConfigById = new Map(
  workspaceMenuConfig
    .filter((entry): entry is WorkspaceMenuItemConfig => entry.kind === "item")
    .map((entry) => [entry.id, entry]),
);

export function buildSettingsMenuEntries({
  closeMenu,
  disabledState,
  menuActions,
  menuState,
  translate,
}: SettingsMenuEntriesInput): SettingsMenuEntry[] {
  const entries: SettingsMenuEntry[] = [];

  for (const layoutEntry of settingsMenuLayout) {
    if (layoutEntry.kind === "divider") {
      entries.push(layoutEntry);
      continue;
    }

    const entry = itemConfigById.get(layoutEntry.id);
    if (!entry) continue;

    if (entry.trailing === "language") {
      entries.push({ kind: "language", id: entry.id });
      continue;
    }

    const action = menuActions[entry.action];
    if (!action) continue;

    entries.push({
      kind: "item",
      id: entry.id,
      icon: entry.icon(menuState),
      label: translate((entry.controlLabelKey ?? entry.labelKey)(menuState)),
      active: entry.activeKey ? menuState[entry.activeKey] : undefined,
      danger: entry.danger,
      disabled: entry.disabledKey ? disabledState[entry.disabledKey] : undefined,
      expanded: entry.expandedKey ? menuState[entry.expandedKey] : undefined,
      trailing: stateChipActions.has(entry.action)
        ? renderStateChip(entry, menuState)
        : undefined,
      onClick: () => {
        action();
        if (entry.closeOnSelect !== false && !stayOpenActions.has(entry.action)) {
          closeMenu();
        }
      },
    });
  }

  return entries;
}

function renderStateChip(
  item: WorkspaceMenuItemConfig,
  menuState: WorkspaceMenuState,
) {
  return item.stateChipKey ? <StateChip on={menuState[item.stateChipKey]} /> : undefined;
}
