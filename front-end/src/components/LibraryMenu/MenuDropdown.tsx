import { Library, Loader2, Plus, X } from "lucide-react";
import { useRef } from "react";
import { ACCEPTED_UPLOAD_TYPES } from "@/lib/constants";
import { cx, ui } from "@/lib/uiClasses";
import type { DocumentSummary } from "@/lib/types";
import { DocumentLibrary } from "../DocumentLibrary";

interface MenuDropdownProps {
  library: DocumentSummary[];
  libraryLoading: boolean;
  activeId: string | null;
  deletingId: string | null;
  isUploading: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onFile: (file: File | null) => void;
  onClose: () => void;
}

export function MenuDropdown({
  library,
  libraryLoading,
  activeId,
  deletingId,
  isUploading,
  onSelect,
  onDelete,
  onFile,
  onClose
}: MenuDropdownProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | null) => {
    onFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
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
          onClick={onClose}
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
        onSelect={onSelect}
        onDelete={onDelete}
      />

      {isUploading ? (
        <UploadingRow />
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
            accept={ACCEPTED_UPLOAD_TYPES}
            className="sr-only"
            onChange={(event) => handleFile(event.target.files?.item(0) ?? null)}
          />
        </>
      )}
    </div>
  );
}

function UploadingRow() {
  return (
    <div
      className="mt-3 grid place-items-center gap-2 rounded-lg border border-line bg-panel px-3 py-4 text-muted"
      role="status"
      aria-live="polite"
    >
      <Loader2 className={ui.spin} size={20} aria-hidden />
      <span className="text-[0.85rem]">Processing your upload…</span>
    </div>
  );
}
