import { AlertTriangle, RotateCcw, Trash2, type LucideIcon } from "lucide-react";
import { useEffect } from "react";
import { cx, ui } from "@/lib/uiClasses";

type ConfirmTone = "restart" | "delete";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  tone?: ConfirmTone;
  onConfirm: () => void;
  onCancel: () => void;
}

const TONE_ICON: Record<ConfirmTone, LucideIcon> = {
  restart: RotateCcw,
  delete: Trash2
};

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  tone = "restart",
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const ConfirmIcon = TONE_ICON[tone];
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
      if (event.key === "Enter") onConfirm();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel, onConfirm]);

  if (!open) {
    return null;
  }

  return (
    <div className={ui.modalBackdrop} onClick={onCancel}>
      <div
        className={ui.modalCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={ui.modalHead}>
          <div className={ui.modalIcon} aria-hidden>
            <AlertTriangle size={20} />
          </div>
          <div>
            <h3 id="confirm-title" className={ui.modalTitle}>
              {title}
            </h3>
            <p id="confirm-body" className={ui.modalBody}>
              {body}
            </p>
          </div>
        </div>
        <div className={ui.modalActions}>
          <button className={ui.button} type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className={cx(ui.buttonDanger)} type="button" onClick={onConfirm} autoFocus>
            <ConfirmIcon size={16} aria-hidden />
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
