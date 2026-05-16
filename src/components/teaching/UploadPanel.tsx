import { AlertTriangle, Loader2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import type { UploadState } from "./types";

type UploadPanelProps = {
  uploadState: UploadState;
  error: string | null;
  onFile: (file: File | null) => void;
};

const ACCEPTED_TYPES =
  ".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown";

/** Drag-and-drop / file-picker surface for uploading a lesson document. */
export function UploadPanel({ uploadState, error, onFile }: UploadPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  if (uploadState === "processing") {
    return (
      <div className="upload-surface surface processing" role="status" aria-live="polite">
        <Loader2 className="spin" size={42} aria-hidden />
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
    <div className="upload-surface surface">
      <label
        className={`drop-target${isDragOver ? " is-drag-over" : ""}`}
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
          <h2>Upload a Lesson Source</h2>
          <p>PDF, text, and markdown files up to 25MB.</p>
        </div>
        <div className="button-row">
          <span className="button primary">
            <UploadCloud size={18} aria-hidden />
            Choose file
          </span>
        </div>
        <input
          ref={fileInputRef}
          className="file-input"
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={(event) => handleFile(event.target.files?.item(0) ?? null)}
        />
      </label>
      {error ? (
        <p className="error-text" role="alert">
          <AlertTriangle size={16} aria-hidden /> {error}
        </p>
      ) : null}
    </div>
  );
}
