import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDismissable } from "@/hooks/useDismissable";
import { useFullscreen } from "@/hooks/useFullscreen";
import {
  getWorkspaceLanguageLabel,
  type WorkspaceMenuActionMap,
  type WorkspaceMenuDisabledState,
  type WorkspaceMenuState,
} from "@/components/workspace/workspaceMenuConfig";

import { buildDesktopWorkspaceMenuEntries } from "./menuEntries";
import type { WorkspaceMenuProps } from "./types";

export function useWorkspaceMenuController({
  showTranscript,
  showCaption,
  teacherAsks,
  teacherAsksDisabled,
  restartDisabled,
  onEditPages,
  onToggleTranscript,
  onToggleCaption,
  onToggleTeacherAsks,
  onRestart,
}: WorkspaceMenuProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();
  const currentLang = i18n.resolvedLanguage ?? i18n.language;
  const closeMenu = () => setOpen(false);

  useDismissable(open, rootRef, closeMenu);

  const runAndClose = (action: () => void) => {
    action();
    closeMenu();
  };

  const menuState: WorkspaceMenuState = {
    isFullscreen,
    langOpen,
    showCaption,
    showTranscript,
    teacherAsks,
  };
  const disabledState: WorkspaceMenuDisabledState = {
    restartDisabled,
    teacherAsksDisabled,
  };
  const menuActions: WorkspaceMenuActionMap = {
    editPages: onEditPages,
    fullscreen: toggleFullscreen,
    language: () => setLangOpen((value) => !value),
    restart: () => {
      closeMenu();
      setConfirmOpen(true);
    },
    toggleCaption: onToggleCaption,
    toggleTeacherAsks: onToggleTeacherAsks,
    toggleTranscript: onToggleTranscript,
  };

  return {
    confirmOpen,
    currentLang,
    labels: {
      cancel: t("common.cancel"),
      dialogBody: t("dialogs.restart.body"),
      dialogConfirm: t("dialogs.restart.confirm"),
      dialogTitle: t("dialogs.restart.title"),
      lessonControls: t("workspaceMenu.lessonControls"),
      lessonControlsMenu: t("workspaceMenu.lessonControlsMenu"),
      menu: t("workspaceMenu.menu"),
      menuAria: t("workspaceMenu.menuAria"),
    },
    langOpen,
    menuEntries: buildDesktopWorkspaceMenuEntries({
      closeMenu,
      currentLangLabel: getWorkspaceLanguageLabel(currentLang),
      disabledState,
      menuActions,
      menuState,
      translate: (key) => t(key),
    }),
    open,
    rootRef,
    runAndClose,
    closeConfirm: () => setConfirmOpen(false),
    confirmRestart: () => {
      setConfirmOpen(false);
      onRestart();
    },
    toggleMenu: () => {
      setLangOpen(false);
      setOpen((value) => !value);
    },
  };
}
