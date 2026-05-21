import { AlertTriangle, Library, Loader2, Plus, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { cx, ui } from "@/lib/uiClasses";
import { DocumentLibrary } from "./DocumentLibrary";
import type { DocumentSummary, UploadState } from "@/lib/types";

const ACCEPTED_TYPES =
  ".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown";

interface UploadPanelProps {
  uploadState: UploadState;
  error: string | null;
  library: DocumentSummary[];
  libraryLoading: boolean;
  deletingId: string | null;
  onFile: (file: File | null) => void;
  onSelect: (documentId: string) => void;
  onDelete: (documentId: string) => void;
}

const surface = cx(
  ui.surface,
  "mx-auto my-[clamp(20px,5vh,60px)] max-w-[780px] p-[clamp(18px,3vw,30px)]"
);

/**
 * Landing surface when no document is open: shows the library of previously
 * processed documents (one-tap to resume) and an upload zone for new ones.
 */
export function UploadPanel({
  uploadState,
  error,
  library,
  libraryLoading,
  deletingId,
  onFile,
  onSelect,
  onDelete
}: UploadPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showUploader, setShowUploader] = useState(false);

  if (uploadState === "processing") {
    return (
      <div
        className={cx(surface, "grid min-h-[330px] place-items-center gap-3 text-center")}
        role="status"
        aria-live="polite"
      >
        <Loader2 className={ui.spin} size={42} aria-hidden />
        <h2>Preparing your document</h2>
        <p>Extracting pages, building lesson passages, and warming up the teacher.</p>
      </div>
    );
  }

  const handleFile = (file: File | null) => {
    onFile(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const hasLibrary = library.length > 0;
  const uploaderOpen = showUploader || !hasLibrary;

  return (
    <div className={surface}>
      {hasLibrary ? (
        <section className="grid gap-3">
          <header className="flex items-center justify-between gap-2">
            <h2 className="m-0 inline-flex items-center gap-2 text-[1.05rem] font-bold text-ink">
              <Library size={18} aria-hidden /> Your documents
            </h2>
            {!uploaderOpen ? (
              <button
                type="button"
                className={cx(ui.button, "min-h-11 px-3 py-2 text-[0.86rem]")}
                onClick={() => setShowUploader(true)}
              >
                <Plus size={16} aria-hidden /> New
              </button>
            ) : null}
          </header>
          <DocumentLibrary
            documents={library}
            loading={libraryLoading}
            deletingId={deletingId}
            onSelect={onSelect}
            onDelete={onDelete}
          />
        </section>
      ) : null}

      {uploaderOpen ? (
        <section className={cx(hasLibrary && "mt-5 border-t border-line pt-5")}>
          {!hasLibrary ? (
            <div className="mb-3 text-center">
              <h2 className={ui.introTitle}>Upload a Lesson Source</h2>
              <p className={ui.introCopy}>PDF, text, and markdown files up to 25MB.</p>
            </div>
          ) : (
            <h3 className="m-0 mb-3 text-[0.92rem] font-[650] text-muted">
              Or upload a new file
            </h3>
          )}
          <div
            className={cx(
              "grid min-h-[180px] place-items-center gap-3 rounded-lg border border-dashed border-[oklch(0.66_0.035_154)] bg-[oklch(0.965_0.018_138)] p-[clamp(16px,4vw,28px)] text-center transition-[background,border-color,transform] duration-[160ms] ease-out",
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
              {hasLibrary ? (
                <button
                  type="button"
                  className={ui.button}
                  onClick={() => setShowUploader(false)}
                >
                  Cancel
                </button>
              ) : null}
            </div>
            <input
              ref={fileInputRef}
              className="sr-only"
              type="file"
              accept={ACCEPTED_TYPES}
              onChange={(event) => handleFile(event.target.files?.item(0) ?? null)}
            />
          </div>
        </section>
      ) : null}

      {error ? (
        <p className={cx(ui.errorText, "mt-4 inline-flex items-center gap-1.5")} role="alert">
          <AlertTriangle size={16} aria-hidden /> {error}
        </p>
      ) : null}
    </div>
  );
}
