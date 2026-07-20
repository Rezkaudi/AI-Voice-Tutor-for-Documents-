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
import type {
  WorkspaceMenuActionId,
  WorkspaceMenuConfigEntry,
  WorkspaceMenuItemConfig,
  WorkspaceMenuLabelKey,
} from "./workspaceMenuTypes";
export type {
  WorkspaceMenuActionId,
  WorkspaceMenuActionMap,
  WorkspaceMenuConfigEntry,
  WorkspaceMenuDisabledState,
  WorkspaceMenuItemConfig,
  WorkspaceMenuLabelKey,
  WorkspaceMenuState,
} from "./workspaceMenuTypes";

type WorkspaceMenuIconResolver = WorkspaceMenuItemConfig["icon"];
type WorkspaceMenuLabelResolver = WorkspaceMenuItemConfig["labelKey"];

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
    controlLabelKey: label("controls.liveCaptions"),
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
