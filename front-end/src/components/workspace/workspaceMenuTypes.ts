import type { LucideIcon } from "lucide-react";

export type WorkspaceMenuState = {
  isFullscreen: boolean; langOpen: boolean; showCaption: boolean;
  showTranscript: boolean; teacherAsks: boolean;
};

export type WorkspaceMenuDisabledState = {
  restartDisabled: boolean; teacherAsksDisabled: boolean;
};

type WorkspaceMenuStateKey = keyof WorkspaceMenuState;
type WorkspaceMenuChipKey = "showCaption" | "showTranscript" | "teacherAsks";
type WorkspaceMenuDisabledKey = keyof WorkspaceMenuDisabledState;
type WorkspaceMenuIconResolver = (state: WorkspaceMenuState) => LucideIcon;
type WorkspaceMenuLabelResolver = (state: WorkspaceMenuState) => WorkspaceMenuLabelKey;

export type WorkspaceMenuLabelKey =
  | "common.exitFullscreen"
  | "common.fullscreen"
  | "common.restartLesson"
  | "common.teachingPages"
  | "common.transcript"
  | "controls.liveCaptions"
  | "controls.teacherAsks"
  | "language.label"
  | "workspaceMenu.captions";

export type WorkspaceMenuActionId =
  | "editPages"
  | "fullscreen"
  | "language"
  | "restart"
  | "toggleCaption"
  | "toggleTeacherAsks"
  | "toggleTranscript";

export type WorkspaceMenuActionMap = Record<
  WorkspaceMenuActionId,
  (() => void) | undefined
>;

export type WorkspaceMenuItemConfig = {
  kind: "item"; id: string; action: WorkspaceMenuActionId;
  icon: WorkspaceMenuIconResolver; labelKey: WorkspaceMenuLabelResolver;
  controlLabelKey?: WorkspaceMenuLabelResolver;
  activeKey?: WorkspaceMenuStateKey; closeOnSelect?: boolean; danger?: boolean;
  disabledKey?: WorkspaceMenuDisabledKey; expandedKey?: WorkspaceMenuStateKey;
  stateChipKey?: WorkspaceMenuChipKey; trailing?: "language";
};

export type WorkspaceMenuConfigEntry =
  | WorkspaceMenuItemConfig
  | { kind: "divider"; id: string };
