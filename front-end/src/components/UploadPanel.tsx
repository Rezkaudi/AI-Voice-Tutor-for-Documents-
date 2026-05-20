import { AlertTriangle, Loader2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { cx, ui } from "@/lib/uiClasses";
import type { UploadState } from "@/lib/types";

const ACCEPTED_TYPES =
  ".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown";

interface UploadPanelProps {
  uploadState: UploadState;
  error: string | null;
  onFile: (file: File | null) => void;
}

const uploadSurface = cx(
  ui.surface,
  "mx-auto my-[clamp(26px,6vh,74px)] max-w-[780px] p-[clamp(18px,3vw,34px)]"
);

/** Drag-and-drop / file-picker surface for uploading a lesson document. */
export function UploadPanel({ uploadState, error, onFile }: UploadPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  if (uploadState === "processing") {
    return (
      <div
        className={cx(uploadSurface, "grid min-h-[330px] place-items-center gap-3 text-center")}
        role="status"
        aria-live="polite"
      >
        <Loader2 className={ui.spin} size={42} aria-hidden />
        <h2>Reading the document</h2>
        <p>Extracting pages, building lesson passages, and preparing the teacher.</p>
      </div>
    );
  }

  // Resetting the input value lets the user re-pick the same file afterwards.
  const handleFile = (file: File | null) => {
    onFile(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className={uploadSurface}>
      <label
        className={cx(
          "grid min-h-[250px] place-items-center gap-4 rounded-lg border border-dashed border-[oklch(0.66_0.035_154)] bg-[oklch(0.965_0.018_138)] p-7 text-center transition-[background,border-color,transform] duration-[160ms] ease-out",
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
        <UploadCloud size={42} aria-hidden />
        <div>
          <h2 className={ui.introTitle}>Upload a Lesson Source</h2>
          <p className={ui.introCopy}>PDF, text, and markdown files up to 25MB.</p>
        </div>
        <div className={ui.buttonRow}>
          <span className={cx(ui.button, ui.buttonPrimary)}>
            <UploadCloud size={18} aria-hidden />
            Choose file
          </span>
        </div>
        <input
          ref={fileInputRef}
          className="pointer-events-none absolute h-px w-px opacity-0"
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={(event) => handleFile(event.target.files?.item(0) ?? null)}
        />
      </label>
      {error ? (
        <p className={cx(ui.errorText, "mt-4 inline-flex items-center gap-1.5")} role="alert">
          <AlertTriangle size={16} aria-hidden /> {error}
        </p>
      ) : null}
    </div>
  );
}
