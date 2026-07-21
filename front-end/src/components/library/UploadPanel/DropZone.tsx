import { FileDown, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { ACCEPTED_UPLOAD_TYPES } from "@/lib/constants";
import { cx } from "@/lib/uiClasses";
import { pickUploadFile, type UploadRejectReason } from "@/lib/uploadValidation";

interface DropZoneProps {
  onFile: (file: File | null) => void;
  onReject?: (message: string) => void;
}

export function DropZone({ onFile, onReject }: DropZoneProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Track enter/leave depth so moving over child nodes doesn't clear the state.
  const dragDepth = useRef(0);
  const [isDragOver, setIsDragOver] = useState(false);

  const rejectMessage = (reason: UploadRejectReason) =>
    reason === "size" ? t("upload.errorSize") : t("upload.errorType");

  const submit = (files: FileList | File[]) => {
    const picked = pickUploadFile(files);
    if (picked.file) {
      onFile(picked.file);
    } else if (picked.reason) {
      onReject?.(rejectMessage(picked.reason));
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openPicker = () => fileInputRef.current?.click();

  const endDrag = () => {
    dragDepth.current = 0;
    setIsDragOver(false);
  };

  // Only react to drags that actually carry files (not text, links, etc.).
  const isFileDrag = (event: React.DragEvent) =>
    event.dataTransfer.types.includes("Files");

  return (
    <button
      type="button"
      onClick={openPicker}
      aria-label={t("upload.dropAria")}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openPicker();
        }
      }}
      className={cx(
        "group relative grid w-full min-h-[180px] cursor-pointer place-items-center gap-3 overflow-hidden rounded-lg border border-dashed border-[oklch(0.66_0.035_154)] bg-[oklch(0.965_0.018_138)] p-[clamp(16px,4vw,28px)] text-center transition-[background,border-color,box-shadow,transform] duration-200 ease-out hover:border-accent hover:bg-[oklch(0.93_0.05_154)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        isDragOver
          ? "scale-[1.015] border-solid border-accent bg-[oklch(0.9_0.07_154)] shadow-[0_0_0_4px_oklch(0.58_0.11_154_/_0.18),0_18px_45px_oklch(0.58_0.11_154_/_0.22)]"
          : "shadow-none"
      )}
      onDragEnter={(event) => {
        if (!isFileDrag(event)) return;
        event.preventDefault();
        dragDepth.current += 1;
        setIsDragOver(true);
      }}
      onDragOver={(event) => {
        if (!isFileDrag(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setIsDragOver(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        endDrag();
        if (event.dataTransfer.files.length > 0) submit(event.dataTransfer.files);
      }}
    >
      {isDragOver ? (
        <span
          key="active"
          className="grid animate-drop-in place-items-center gap-3 text-accent-ink"
        >
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[oklch(0.99_0.009_86)] text-accent shadow-[0_6px_16px_oklch(0.58_0.11_154_/_0.3)]">
            <FileDown size={30} strokeWidth={2.2} className="animate-drop-bob" aria-hidden />
          </span>
          <p className="m-0 text-[0.98rem] font-[680]">{t("upload.dropActive")}</p>
        </span>
      ) : (
        <span key="idle" className="grid place-items-center gap-3">
          <UploadCloud
            size={36}
            aria-hidden
            className="text-muted transition-[color,transform] duration-200 ease-out group-hover:-translate-y-0.5 group-hover:text-accent"
          />
          <p className="m-0 text-[0.92rem] text-muted">
            <Trans
              i18nKey="upload.dropHint"
              components={{ choose: <span className="font-[650] text-ink underline" /> }}
            />
          </p>
        </span>
      )}
      <input
        ref={fileInputRef}
        className="sr-only"
        type="file"
        accept={ACCEPTED_UPLOAD_TYPES}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => {
          if (event.target.files) submit(event.target.files);
        }}
      />
    </button>
  );
}
