import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "@/lib/uiClasses";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import type { DocumentSummary } from "@/types";
import { DocumentRow } from "./DocumentRow";
import { EmptyState } from "./EmptyState";
import { LoadingState } from "./LoadingState";

interface DocumentLibraryProps {
  documents: DocumentSummary[];
  activeId?: string | null;
  loading?: boolean;
  deletingId?: string | null;
  onSelect: (documentId: string) => void;
  onDelete?: (documentId: string) => void;
  emptyHint?: string;
  fillHeight?: boolean;
}

export function DocumentLibrary({
  documents,
  activeId,
  loading,
  deletingId,
  onSelect,
  onDelete,
  emptyHint,
  fillHeight
}: DocumentLibraryProps) {
  const { t } = useTranslation();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (loading && documents.length === 0) return <LoadingState />;
  if (documents.length === 0) return <EmptyState hint={emptyHint} />;

  const confirmingDoc = confirmId ? documents.find((d) => d.id === confirmId) ?? null : null;
  const confirmingName =
    confirmingDoc?.title || confirmingDoc?.fileName || t("library.thisDocument");

  return (
    <>
      <ul
        className={cx(
          "m-0 flex list-none flex-col gap-1.5 overflow-y-auto p-0",
          fillHeight ? "min-h-0 flex-1" : "max-h-[min(56vh,420px)]"
        )}
        role="listbox"
        aria-label={t("library.listAria")}
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
        title={t("dialogs.delete.title")}
        body={t("dialogs.delete.body", { name: confirmingName })}
        confirmLabel={t("dialogs.delete.confirm")}
        cancelLabel={t("common.cancel")}
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
