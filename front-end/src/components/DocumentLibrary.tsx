import { Check, FileText, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { cx, ui } from "@/lib/uiClasses";
import type { DocumentSummary } from "@/lib/types";
import { ConfirmDialog } from "./ConfirmDialog";

interface DocumentLibraryProps {
  documents: DocumentSummary[];
  activeId?: string | null;
  loading?: boolean;
  deletingId?: string | null;
  onSelect: (documentId: string) => void;
  onDelete?: (documentId: string) => void;
  emptyHint?: string;
}

/** Browseable list of previously processed documents the learner can switch to or delete. */
export function DocumentLibrary({
  documents,
  activeId,
  loading,
  deletingId,
  onSelect,
  onDelete,
  emptyHint
}: DocumentLibraryProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (loading && documents.length === 0) {
    return (
      <div
        className="grid place-items-center gap-2 px-2 py-8 text-muted"
        role="status"
        aria-live="polite"
      >
        <Loader2 className={ui.spin} size={22} aria-hidden />
        <span className="text-[0.86rem]">Loading your library…</span>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <p className="m-0 rounded-lg border border-dashed border-line bg-paper-strong/60 px-3 py-4 text-center text-[0.86rem] text-muted">
        {emptyHint ?? "No documents yet — upload your first to get started."}
      </p>
    );
  }

  const confirmingDoc = confirmId ? documents.find((d) => d.id === confirmId) ?? null : null;
  const confirmingName =
    confirmingDoc?.title || confirmingDoc?.fileName || "this document";

  return (
    <>
      <ul
        className="m-0 flex max-h-[min(56vh,420px)] list-none flex-col gap-1.5 overflow-y-auto p-0"
        role="listbox"
        aria-label="Your documents"
      >
        {documents.map((doc) => {
          const isActive = doc.id === activeId;
          const isDeleting = deletingId === doc.id;

          return (
            <li key={doc.id}>
              <div
                className={cx(
                  "group relative flex w-full items-stretch gap-1 rounded-lg border border-line bg-paper-strong transition-[background,border-color] duration-140 ease-out",
                  "hover:border-accent",
                  isActive && "border-accent bg-[oklch(0.96_0.04_154)]",
                  isDeleting && "opacity-60"
                )}
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  disabled={isDeleting}
                  onClick={() => onSelect(doc.id)}
                  className={cx(
                    "flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-l-lg px-3 py-2.5 text-left",
                    ui.focusAccent,
                    "disabled:cursor-not-allowed"
                  )}
                >
                  <span
                    className={cx(
                      "grid h-9 w-9 flex-none place-items-center rounded-md border border-line bg-panel text-muted",
                      isActive && "border-accent bg-accent text-paper-strong"
                    )}
                    aria-hidden
                  >
                    <FileText size={18} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[0.95rem] font-[650] leading-tight text-ink">
                      {doc.title || doc.fileName || "Untitled document"}
                    </span>
                    <span className="mt-0.5 truncate text-[0.78rem] text-muted">
                      {formatMeta(doc)}
                    </span>
                  </span>
                  {isActive ? (
                    <Check
                      size={18}
                      className="flex-none text-accent"
                      aria-label="Currently open"
                    />
                  ) : null}
                </button>

                {onDelete ? (
                  <button
                    type="button"
                    title="Delete document"
                    aria-label={`Delete ${doc.title || doc.fileName || "document"}`}
                    disabled={isDeleting}
                    onClick={() => setConfirmId(doc.id)}
                    className={cx(
                      "my-1.5 mr-1.5 grid h-8 w-8 flex-none place-items-center self-center rounded-md text-muted transition-colors hover:bg-[oklch(0.96_0.04_28)] hover:text-danger",
                      ui.focusAccent,
                      "disabled:cursor-not-allowed"
                    )}
                  >
                    {isDeleting ? (
                      <Loader2 className={ui.spin} size={16} aria-hidden />
                    ) : (
                      <Trash2 size={16} aria-hidden />
                    )}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={confirmingDoc !== null}
        title="Delete document?"
        body={`This permanently removes “${confirmingName}” from your library. This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="delete"
        onCancel={() => setConfirmId(null)}
        onConfirm={() => {
          if (confirmingDoc && onDelete) onDelete(confirmingDoc.id);
          setConfirmId(null);
        }}
      />
    </>
  );
}

function formatMeta(doc: DocumentSummary): string {
  const parts: string[] = [];
  parts.push(`${doc.pageCount} ${doc.pageCount === 1 ? "page" : "pages"}`);
  if (doc.fileType) {
    parts.push(doc.fileType.toUpperCase());
  }
  if (doc.updatedAt) {
    const date = new Date(doc.updatedAt);
    if (!Number.isNaN(date.getTime())) {
      parts.push(relativeTime(date));
    }
  }
  return parts.join(" · ");
}

function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}
