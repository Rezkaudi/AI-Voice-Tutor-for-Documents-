import { AlertTriangle, Library, Plus } from "lucide-react";
import { useState } from "react";
import { cx, ui } from "@/lib/uiClasses";
import type { DocumentSummary, UploadState } from "@/lib/types";
import { DocumentLibrary } from "../DocumentLibrary";
import { DropZone } from "./DropZone";
import { ProcessingState } from "./ProcessingState";

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
  const [showUploader, setShowUploader] = useState(false);

  if (uploadState === "processing") {
    return <ProcessingState surfaceClass={surface} />;
  }

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
          <DropZone
            onFile={onFile}
            showCancel={hasLibrary}
            onCancel={() => setShowUploader(false)}
          />
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
