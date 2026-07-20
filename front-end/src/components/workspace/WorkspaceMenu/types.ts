export interface WorkspaceMenuProps {
  showTranscript: boolean;
  showCaption: boolean;
  teacherAsks: boolean;
  teacherAsksDisabled: boolean;
  restartDisabled: boolean;
  onEditPages?: () => void;
  onToggleTranscript: () => void;
  onToggleCaption: () => void;
  onToggleTeacherAsks: () => void;
  onRestart: () => void;
}
