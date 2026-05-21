import { Library, Loader2, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cx, ui } from "@/lib/uiClasses";
import { DocumentLibrary } from "./DocumentLibrary";
import type { DocumentSummary, UploadState } from "@/lib/types";

const ACCEPTED_TYPES =
  ".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown";

interface LibraryMenuProps {
  library: DocumentSummary[];
  libraryLoading: boolean;
  activeId: string | null;
  uploadState: UploadState;
  deletingId: string | null;
  onSelect: (documentId: string) => void;
  onFile: (file: File | null) => void;
  onDelete: (documentId: string) => void;
}

/** Header dropdown: switch between previously uploaded documents, delete, or add a new one. */
export function LibraryMenu({
  library,
  libraryLoading,
  activeId,
  uploadState,
  deletingId,
  onSelect,
  onFile,
  onDelete
}: LibraryMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isUploading = uploadState === "processing";

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", handlePointer);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handlePointer);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  // Auto-close once the upload completes.
  useEffect(() => {
    if (!isUploading && open && fileInputRef.current?.value) {
      fileInputRef.current.value = "";
    }
  }, [isUploading, open]);

  const handleSelect = (id: string) => {
    setOpen(false);
    onSelect(id);
  };

  const handleFile = (file: File | null) => {
    onFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className={cx(ui.button, "min-h-11 px-3 py-2 text-[0.86rem]")}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Library size={16} aria-hidden /> Library
        {library.length > 0 ? (
          <span
            className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[0.72rem] font-bold text-paper-strong"
            aria-hidden
          >
            {library.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Your documents"
          className={cx(
            "absolute right-0 z-50 mt-2 w-[min(360px,calc(100vw-32px))] origin-top-right",
            ui.surface,
            "p-3 shadow-[0_18px_50px_oklch(0.18_0.03_244/0.22)] animate-modal-pop"
          )}
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="m-0 inline-flex items-center gap-2 text-[0.95rem] font-bold text-ink">
              <Library size={16} aria-hidden /> Your documents
            </h3>
            <button
              type="button"
              className={cx(ui.iconButton, "min-h-9 w-9")}
              onClick={() => setOpen(false)}
              aria-label="Close library"
            >
              <X size={16} aria-hidden />
            </button>
          </div>

          <DocumentLibrary
            documents={library}
            activeId={activeId}
            loading={libraryLoading}
            deletingId={deletingId}
            onSelect={handleSelect}
            onDelete={onDelete}
          />

          {isUploading ? (
            <div
              className="mt-3 grid place-items-center gap-2 rounded-lg border border-line bg-panel px-3 py-4 text-muted"
              role="status"
              aria-live="polite"
            >
              <Loader2 className={ui.spin} size={20} aria-hidden />
              <span className="text-[0.85rem]">Processing your upload…</span>
            </div>
          ) : (
            <>
              <button
                type="button"
                className={cx(ui.button, "mt-3 w-full justify-center")}
                onClick={() => fileInputRef.current?.click()}
              >
                <Plus size={16} aria-hidden /> Upload new
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                className="sr-only"
                onChange={(event) => handleFile(event.target.files?.item(0) ?? null)}
              />
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
