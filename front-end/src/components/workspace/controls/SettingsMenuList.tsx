import { LanguageMenu } from "./LanguageMenu";
import { MenuDivider, MenuItem } from "./MenuItem";
import type { SettingsMenuEntry } from "./settingsMenuTypes";

interface SettingsMenuListProps {
  entries: SettingsMenuEntry[];
  onLanguageSelect: () => void;
}

export function SettingsMenuList({
  entries,
  onLanguageSelect,
}: SettingsMenuListProps) {
  return (
    <>
      {entries.map((entry) => {
        if (entry.kind === "divider") {
          return <MenuDivider key={entry.id} />;
        }

        if (entry.kind === "language") {
          return <LanguageMenu key={entry.id} onSelect={onLanguageSelect} />;
        }

        return (
          <MenuItem
            key={entry.id}
            icon={entry.icon}
            label={entry.label}
            active={entry.active}
            danger={entry.danger}
            disabled={entry.disabled}
            expanded={entry.expanded}
            trailing={entry.trailing}
            onClick={entry.onClick}
          />
        );
      })}
    </>
  );
}
