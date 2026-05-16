import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Accessible modal that confirms a destructive action (Enter / Escape aware). */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
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
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div className="modal-icon" aria-hidden>
            <AlertTriangle size={20} />
          </div>
          <div>
            <h3 id="confirm-title" className="modal-title">
              {title}
            </h3>
            <p id="confirm-body" className="modal-body">
              {body}
            </p>
          </div>
        </div>
        <div className="modal-actions">
          <button className="button" type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className="button danger" type="button" onClick={onConfirm} autoFocus>
            <RotateCcw size={16} aria-hidden />
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
