import type { WorkspaceMenuActionId } from "@/components/workspace/workspaceMenuConfig";

export const settingsMenuLayout = [
  { kind: "item", id: "edit-pages" },
  { kind: "item", id: "fullscreen" },
  { kind: "divider", id: "view-divider" },
  { kind: "item", id: "teacher-asks" },
  { kind: "item", id: "captions" },
  { kind: "item", id: "transcript" },
  { kind: "divider", id: "language-divider" },
  { kind: "item", id: "language" },
  { kind: "divider", id: "restart-divider" },
  { kind: "item", id: "restart" },
] as const;

export const stayOpenActions = new Set<WorkspaceMenuActionId>([
  "toggleCaption",
  "toggleTeacherAsks",
]);

export const stateChipActions = new Set<WorkspaceMenuActionId>([
  "toggleCaption",
  "toggleTeacherAsks",
]);
