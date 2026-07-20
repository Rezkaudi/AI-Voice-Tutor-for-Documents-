import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useFullscreen } from "@/hooks/useFullscreen";
import { useChatStore } from "@/store/chatStore";
import { useSessionStore } from "@/store/sessionStore";
import {
  type WorkspaceMenuActionMap,
  type WorkspaceMenuDisabledState,
  type WorkspaceMenuState,
} from "@/components/workspace/workspaceMenuConfig";

import { buildSettingsMenuEntries } from "./settingsMenuEntries";

export function useSettingsMenuController() {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  const callMode = useSessionStore((s) => s.callMode);
  const clearChat = useSessionStore((s) => s.clearChat);
  const openPageDialog = useSessionStore((s) => s.openPageDialog);
  const showCaption = useSessionStore((s) => s.showCaption);
  const showTranscript = useSessionStore((s) => s.showTranscript);
  const teacherAsks = useSessionStore((s) => s.teacherAsks);
  const toggleCaption = useSessionStore((s) => s.toggleCaption);
  const toggleTeacherAsks = useSessionStore((s) => s.toggleTeacherAsks);
  const toggleTranscript = useSessionStore((s) => s.toggleTranscript);
  const hasMessages = useChatStore((s) => s.messages.length > 0);

  const closeMenu = () => setMenuOpen(false);
  useEscapeKey(closeMenu, menuOpen);

  const requestRestart = () => {
    closeMenu();
    if (!hasMessages && !callMode) clearChat();
    else setConfirmOpen(true);
  };

  const menuState: WorkspaceMenuState = {
    isFullscreen,
    langOpen: false,
    showCaption,
    showTranscript,
    teacherAsks,
  };
  const disabledState: WorkspaceMenuDisabledState = {
    restartDisabled: false,
    teacherAsksDisabled: callMode,
  };
  const menuActions: WorkspaceMenuActionMap = {
    editPages: openPageDialog,
    fullscreen: toggleFullscreen,
    language: undefined,
    restart: requestRestart,
    toggleCaption,
    toggleTeacherAsks,
    toggleTranscript,
  };

  return {
    closeConfirm: () => setConfirmOpen(false),
    closeMenu,
    confirmOpen,
    confirmRestart: () => {
      setConfirmOpen(false);
      clearChat();
    },
    entries: buildSettingsMenuEntries({
      closeMenu,
      disabledState,
      menuActions,
      menuState,
      translate: (key) => t(key),
    }),
    labels: {
      close: t("controls.settings.close"),
      menu: t("controls.settings.open"),
      cancel: t("common.cancel"),
      dialogBody: t("dialogs.restart.body"),
      dialogConfirm: t("dialogs.restart.confirm"),
      dialogTitle: t("dialogs.restart.title"),
    },
    menuOpen,
    toggleMenu: () => setMenuOpen((value) => !value),
  };
}
