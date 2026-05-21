import { UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { ACCEPTED_UPLOAD_TYPES } from "@/lib/constants";
import { cx, ui } from "@/lib/uiClasses";

interface DropZoneProps {
  onFile: (file: File | null) => void;
  showCancel: boolean;
  onCancel?: () => void;
}

/** Drag-and-drop / file-picker zone for a single document upload. */
export function DropZone({ onFile, showCancel, onCancel }: DropZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFile = (file: File | null) => {
    onFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div
      className={cx(
        "grid min-h-[180px] place-items-center gap-3 rounded-lg border border-dashed border-[oklch(0.66_0.035_154)] bg-[oklch(0.965_0.018_138)] p-[clamp(16px,4vw,28px)] text-center transition-[background,border-color,transform] duration-160 ease-out",
        isDragOver && "scale-[1.01] border-accent bg-[oklch(0.93_0.05_154)]"
      )}
      onDragOver={(event) => {
        event.preventDefault();
        if (!isDragOver) setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragOver(false);
        handleFile(event.dataTransfer.files.item(0));
      }}
    >
      <UploadCloud size={36} aria-hidden />
      <p className="m-0 text-[0.92rem] text-muted">Drop a file here, or</p>
      <div className={ui.buttonRow}>
        <button
          type="button"
          className={cx(ui.button, ui.buttonPrimary)}
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadCloud size={18} aria-hidden />
          Choose file
        </button>
        {showCancel ? (
          <button type="button" className={ui.button} onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
      <input
        ref={fileInputRef}
        className="sr-only"
        type="file"
        accept={ACCEPTED_UPLOAD_TYPES}
        onChange={(event) => handleFile(event.target.files?.item(0) ?? null)}
      />
    </div>
  );
}
