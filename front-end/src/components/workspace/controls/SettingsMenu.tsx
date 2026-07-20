import { Settings2, X } from "lucide-react";
import { cx } from "@/lib/uiClasses";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  popover,
  popoverPosLarge,
  popoverPosSmall,
  triggerBase,
  triggerClosed,
  triggerOpen,
  wrapLarge,
  wrapSmall
} from "@/styles/components/workspace/controls/settingsMenu";

import { SettingsMenuList } from "./SettingsMenuList";
import { useSettingsMenuController } from "./useSettingsMenuController";

interface SettingsMenuProps {
  large?: boolean;
}

/** Settings popover: trigger button, dropdown of session options, and restart confirm. */
export function SettingsMenu({ large = false }: SettingsMenuProps) {
  const menu = useSettingsMenuController();
  const wrapClass = large ? wrapLarge : wrapSmall;
  const popoverPos = large ? popoverPosLarge : popoverPosSmall;

  return (
    <>
      {menu.menuOpen ? (
        <div className="fixed inset-0 z-40" aria-hidden onClick={menu.closeMenu} />
      ) : null}

      <div className={wrapClass}>
        {menu.menuOpen ? (
          <div
            className={cx(popover, popoverPos)}
            role="menu"
            aria-label={menu.labels.menu}
          >
            <SettingsMenuList
              entries={menu.entries}
              onLanguageSelect={menu.closeMenu}
            />
          </div>
        ) : null}

        <button
          type="button"
          className={cx(triggerBase, menu.menuOpen ? triggerOpen : triggerClosed)}
          aria-label={menu.menuOpen ? menu.labels.close : menu.labels.menu}
          aria-expanded={menu.menuOpen}
          aria-haspopup="menu"
          onClick={menu.toggleMenu}
        >
          {menu.menuOpen ? <X size={18} aria-hidden /> : <Settings2 size={18} aria-hidden />}
        </button>
      </div>

      <ConfirmDialog
        open={menu.confirmOpen}
        title={menu.labels.dialogTitle}
        body={menu.labels.dialogBody}
        confirmLabel={menu.labels.dialogConfirm}
        cancelLabel={menu.labels.cancel}
        onCancel={menu.closeConfirm}
        onConfirm={menu.confirmRestart}
      />
    </>
  );
}
