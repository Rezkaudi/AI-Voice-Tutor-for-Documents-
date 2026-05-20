import { MicOff } from "lucide-react";
import { useEffect } from "react";
import { cx, ui } from "@/lib/uiClasses";

/** Universal steps for re-enabling a blocked microphone in any browser. */
const ENABLE_STEPS = [
  "Click the icon on the left of the address bar (a lock, tune/sliders, or microphone icon).",
  'Find "Microphone" and set it to Allow — or click "Reset permission".',
  "Reload the page.",
  "Press Call again, then choose Allow if asked."
];

interface MicPermissionDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Explains how to re-enable a blocked microphone. A blocked browser permission
 * cannot be re-prompted from code, so this guides the user through their
 * browser's site settings instead. The dialog auto-closes (via `open`) once the
 * caller detects the permission has flipped back to granted.
 */
export function MicPermissionDialog({ open, onClose }: MicPermissionDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className={ui.modalBackdrop} onClick={onClose}>
      <div
        className={ui.modalCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mic-perm-title"
        aria-describedby="mic-perm-body"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={ui.modalHead}>
          <div className={ui.modalIcon} aria-hidden>
            <MicOff size={20} />
          </div>
          <div>
            <h3 id="mic-perm-title" className={ui.modalTitle}>
              Turn on your microphone
            </h3>
            <p id="mic-perm-body" className={ui.modalBody}>
              Your browser is blocking microphone access, so the voice lesson can&apos;t hear you.
              The browser won&apos;t ask again automatically — please re-enable it in your browser
              settings:
            </p>
          </div>
        </div>

        <ol className={ui.micSteps}>
          {ENABLE_STEPS.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>

        <p className={ui.micNote}>
          Once you set it to <strong>Allow</strong>, the lesson resumes automatically — or just
          press <strong>Call</strong> again.
        </p>

        <div className={ui.modalActions}>
          <button className={cx(ui.button, ui.buttonPrimary)} type="button" onClick={onClose} autoFocus>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
