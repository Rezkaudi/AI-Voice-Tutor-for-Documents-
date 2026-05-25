import { UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { ACCEPTED_UPLOAD_TYPES } from "@/lib/constants";
import { cx, ui } from "@/lib/uiClasses";

interface DropZoneProps {
  onFile: (file: File | null) => void;
}

/** Drag-and-drop / file-picker zone for a single document upload. */
export function DropZone({ onFile }: DropZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFile = (file: File | null) => {
    onFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openPicker = () => fileInputRef.current?.click();

  return (
    <button
      type="button"
      onClick={openPicker}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openPicker();
        }
      }}
      className={cx(
        "grid w-full min-h-[180px] cursor-pointer place-items-center gap-3 rounded-lg border border-dashed border-[oklch(0.66_0.035_154)] bg-[oklch(0.965_0.018_138)] p-[clamp(16px,4vw,28px)] text-center transition-[background,border-color,transform] duration-160 ease-out hover:border-accent hover:bg-[oklch(0.93_0.05_154)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
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
      <p className="m-0 text-[0.92rem] text-muted">
        Drop a file here, or <span className="font-[650] text-ink underline">choose file</span>
      </p>
      <input
        ref={fileInputRef}
        className="sr-only"
        type="file"
        accept={ACCEPTED_UPLOAD_TYPES}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => handleFile(event.target.files?.item(0) ?? null)}
      />
    </button>
  );
}
