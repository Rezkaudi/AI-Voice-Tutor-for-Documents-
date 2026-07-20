import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { cx } from "@/lib/uiClasses";
import type { PageStatus } from "@/lib/pageSelection";
import {
  pageButtonActive,
  pageButtonBase,
  pageButtonExtracting,
  pageButtonFailed,
  pageButtonIdle,
  pageButtonPending
} from "@/styles/components/workspace/teacher/pageSelectionDialog";

const STATUS_CLASS: Record<PageStatus, string> = {
  ready: pageButtonIdle,
  extracting: pageButtonExtracting,
  pending: pageButtonPending,
  failed: pageButtonFailed
};

interface PageButtonProps {
  page: number;
  status: PageStatus;
  active: boolean;
  disabled: boolean;
  label: string;
  title: string;
  onToggle: (page: number) => void;
}

export function PageButton({
  page,
  status,
  active,
  disabled,
  label,
  title,
  onToggle
}: PageButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={() => onToggle(page)}
      className={cx(pageButtonBase, active ? pageButtonActive : STATUS_CLASS[status])}
    >
      {status === "extracting" ? (
        <Loader2 size={14} className="animate-spin" data-page-spinner aria-hidden />
      ) : (
        page
      )}
      {active ? (
        <Check size={12} className="absolute right-1 top-1 opacity-90" aria-hidden />
      ) : null}
      {status === "failed" ? (
        <AlertTriangle size={11} className="absolute right-1 top-1 opacity-90" aria-hidden />
      ) : null}
    </button>
  );
}
