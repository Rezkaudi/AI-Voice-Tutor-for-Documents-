import { useState } from "react";
import { ConfirmDialog } from "../ConfirmDialog";
import type { DocumentSummary } from "@/lib/types";
import { DocumentRow } from "./DocumentRow";
import { EmptyState, LoadingState } from "./EmptyStates";

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

  if (loading && documents.length === 0) return <LoadingState />;
  if (documents.length === 0) return <EmptyState hint={emptyHint} />;

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
        {documents.map((doc) => (
          <DocumentRow
            key={doc.id}
            doc={doc}
            isActive={doc.id === activeId}
            isDeleting={deletingId === doc.id}
            onSelect={onSelect}
            onRequestDelete={onDelete ? setConfirmId : undefined}
          />
        ))}
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
