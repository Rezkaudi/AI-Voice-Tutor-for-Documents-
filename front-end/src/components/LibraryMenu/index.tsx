import { Library } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useDocumentStore } from "@/store/documentStore";
import { cx, ui } from "@/lib/uiClasses";
import type { DocumentSummary, UploadState } from "@/lib/types";
import { MenuDropdown } from "./MenuDropdown";
import { useDismiss } from "./useDismiss";

interface LibraryMenuProps {
  library: DocumentSummary[];
  libraryLoading: boolean;
  activeId: string | null;
  uploadState: UploadState;
  deletingId: string | null;
  error: string | null;
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
  error,
  onSelect,
  onFile,
  onDelete
}: LibraryMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, containerRef, close);

  const isUploading = uploadState === "processing";

  const handleSelect = (id: string) => {
    close();
    onSelect(id);
  };

  const toggle = () => {
    setOpen((value) => {
      // Clear any stale error from a previous action when reopening, so the
      // sheet only ever surfaces feedback for the upload started inside it.
      if (!value) useDocumentStore.getState().setUploadError(null);
      return !value;
    });
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className={cx(ui.button, "min-h-11 px-3 py-2 text-[0.86rem]")}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
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
        <MenuDropdown
          library={library}
          libraryLoading={libraryLoading}
          activeId={activeId}
          deletingId={deletingId}
          isUploading={isUploading}
          error={error}
          onSelect={handleSelect}
          onDelete={onDelete}
          onFile={onFile}
          onClose={close}
        />
      ) : null}
    </div>
  );
}
