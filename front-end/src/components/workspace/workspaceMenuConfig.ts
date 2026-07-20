import {
  BookOpen,
  Captions,
  Globe,
  Maximize2,
  MessageCircleQuestion,
  Minimize2,
  RotateCcw,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

import { LANGUAGES } from "@/i18n/config";

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

export type WorkspaceMenuItemConfig = {
  kind: "item"; id: string; action: WorkspaceMenuActionId;
  icon: WorkspaceMenuIconResolver; labelKey: WorkspaceMenuLabelResolver;
  activeKey?: WorkspaceMenuStateKey; closeOnSelect?: boolean; danger?: boolean;
  disabledKey?: WorkspaceMenuDisabledKey; expandedKey?: WorkspaceMenuStateKey;
  stateChipKey?: WorkspaceMenuChipKey; trailing?: "language";
};

export type WorkspaceMenuConfigEntry =
  | WorkspaceMenuItemConfig
  | { kind: "divider"; id: string };

type WorkspaceMenuItemOptions = Partial<
  Omit<WorkspaceMenuItemConfig, "action" | "icon" | "id" | "kind" | "labelKey">
>;

const icon = (Icon: LucideIcon): WorkspaceMenuIconResolver => () => Icon;
const label = (key: WorkspaceMenuLabelKey): WorkspaceMenuLabelResolver => () => key;
const item = (
  id: string, action: WorkspaceMenuActionId, menuIcon: WorkspaceMenuIconResolver,
  labelKey: WorkspaceMenuLabelResolver,
  options: WorkspaceMenuItemOptions = {},
): WorkspaceMenuItemConfig => ({
  kind: "item", id, action, icon: menuIcon, labelKey, ...options,
});
const divider = (id: string): WorkspaceMenuConfigEntry => ({ kind: "divider", id });

export const workspaceMenuConfig: readonly WorkspaceMenuConfigEntry[] = [
  item("edit-pages", "editPages", icon(BookOpen), label("common.teachingPages")),
  item("fullscreen", "fullscreen",
    (state) => (state.isFullscreen ? Minimize2 : Maximize2),
    (state) => state.isFullscreen ? "common.exitFullscreen" : "common.fullscreen",
    { activeKey: "isFullscreen" },
  ),
  item("transcript", "toggleTranscript", icon(ScrollText), label("common.transcript"), {
    activeKey: "showTranscript",
    stateChipKey: "showTranscript",
  }),
  item("captions", "toggleCaption", icon(Captions), label("workspaceMenu.captions"), {
    activeKey: "showCaption",
    stateChipKey: "showCaption",
  }),
  item("teacher-asks", "toggleTeacherAsks", icon(MessageCircleQuestion),
    label("controls.teacherAsks"),
    {
      activeKey: "teacherAsks",
      disabledKey: "teacherAsksDisabled",
      stateChipKey: "teacherAsks",
    },
  ),
  divider("language-divider"),
  item("language", "language", icon(Globe), label("language.label"), {
    activeKey: "langOpen",
    closeOnSelect: false,
    expandedKey: "langOpen",
    trailing: "language",
  }),
  divider("restart-divider"),
  item("restart", "restart", icon(RotateCcw), label("common.restartLesson"), {
    closeOnSelect: false,
    danger: true,
    disabledKey: "restartDisabled",
  }),
];

export function getWorkspaceLanguageLabel(currentLang: string) {
  return LANGUAGES.find((lang) => lang.code === currentLang)?.label ?? currentLang;
}
