import { SlidersHorizontal } from "lucide-react";
import { cx } from "@/lib/uiClasses";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  popover,
  triggerBase,
  triggerClosed,
  triggerOpen
} from "@/styles/components/workspace/workspaceMenu";

import { DesktopMenuList } from "./DesktopMenuList";
import type { WorkspaceMenuProps } from "./types";
import { useWorkspaceMenuController } from "./useWorkspaceMenuController";

export function WorkspaceMenu(props: WorkspaceMenuProps) {
  const {
    closeConfirm,
    confirmOpen,
    confirmRestart,
    currentLang,
    labels,
    langOpen,
    menuEntries,
    open,
    rootRef,
    runAndClose,
    toggleMenu,
  } = useWorkspaceMenuController(props);

  return (
    <div ref={rootRef} className="absolute end-4 top-4 z-30">
      {open ? (
        <div
          role="menu"
          aria-label={labels.menuAria}
          className={popover}
        >
          <DesktopMenuList
            currentLang={currentLang}
            entries={menuEntries}
            langOpen={langOpen}
            onLanguageSelect={runAndClose}
          />
        </div>
      ) : null}

      <button
        type="button"
        className={cx(triggerBase, open ? triggerOpen : triggerClosed)}
        aria-label={labels.lessonControlsMenu}
        aria-haspopup="menu"
        aria-expanded={open}
        title={labels.lessonControls}
        onClick={toggleMenu}
      >
        <SlidersHorizontal size={16} aria-hidden />
        <span>{labels.menu}</span>
      </button>

      <ConfirmDialog
        open={confirmOpen}
        title={labels.dialogTitle}
        body={labels.dialogBody}
        confirmLabel={labels.dialogConfirm}
        cancelLabel={labels.cancel}
        onCancel={closeConfirm}
        onConfirm={confirmRestart}
      />
    </div>
  );
}
