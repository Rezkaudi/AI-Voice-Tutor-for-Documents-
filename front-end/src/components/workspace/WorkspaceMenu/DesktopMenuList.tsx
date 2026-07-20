import { Fragment } from "react";

import { divider } from "@/styles/components/workspace/workspaceMenu";

import { LanguageSubmenu } from "./LanguageSubmenu";
import { MenuItem } from "./MenuItem";
import type { DesktopWorkspaceMenuEntry } from "./menuEntries";

interface DesktopMenuListProps {
  currentLang: string;
  entries: DesktopWorkspaceMenuEntry[];
  langOpen: boolean;
  onLanguageSelect: (action: () => void) => void;
}

export function DesktopMenuList({
  currentLang,
  entries,
  langOpen,
  onLanguageSelect,
}: DesktopMenuListProps) {
  return (
    <>
      {entries.map((entry) => {
        if (entry.kind === "divider") {
          return <div key={entry.id} className={divider} />;
        }

        const { kind, id, ...itemProps } = entry;
        return (
          <Fragment key={id}>
            <MenuItem {...itemProps} />
            {kind === "language" && langOpen ? (
              <LanguageSubmenu currentLang={currentLang} onSelect={onLanguageSelect} />
            ) : null}
          </Fragment>
        );
      })}
    </>
  );
}
