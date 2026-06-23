import { AlertTriangle, Info, Library } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx, ui } from "@/lib/uiClasses";
import type { DocumentSummary, UploadState } from "@/types";
import { DocumentLibrary } from "../DocumentLibrary";
import { LoadingState } from "../DocumentLibrary/LoadingState";
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
  "m-auto flex max-h-full w-full max-w-[780px] flex-col p-[clamp(18px,3vw,30px)]"
);

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
  const { t } = useTranslation();
  if (uploadState === "processing") {
    return <ProcessingState surfaceClass={surface} />;
  }

  if (libraryLoading && library.length === 0) {
    return (
      <div className={surface}>
        <LoadingState />
      </div>
    );
  }

  const hasLibrary = library.length > 0;

  return (
    <div className={surface}>
      {hasLibrary ? (
        <section className="flex min-h-0 flex-1 flex-col gap-3">
          <header className="flex flex-none items-center justify-between gap-2">
            <h2 className="m-0 inline-flex items-center gap-2 text-[1.05rem] font-bold text-ink">
              <Library size={18} aria-hidden /> {t("upload.yourDocuments")}
            </h2>
          </header>
          <DocumentLibrary
            documents={library}
            loading={libraryLoading}
            deletingId={deletingId}
            onSelect={onSelect}
            onDelete={onDelete}
            fillHeight
          />
        </section>
      ) : null}

      <section className={cx("flex-none", hasLibrary && "mt-5 border-t border-line pt-5")}>
        {!hasLibrary ? (
          <div className="mb-3 text-center">
            <h2 className={ui.introTitle}>{t("upload.uploadTitle")}</h2>
            <p className={ui.introCopy}>{t("upload.pdfLimit")}</p>
          </div>
        ) : (
          <h3 className="m-0 mb-3 text-[0.92rem] font-[650] text-muted">
            {t("upload.orUploadNew")}
          </h3>
        )}
        <DropZone onFile={onFile} />
        <p className="mt-3 inline-flex items-center gap-1.5 text-[0.8rem] text-muted">
          <Info size={14} aria-hidden className="flex-none" />
          {t("upload.pdfHint")}
        </p>
      </section>

      {error ? (
        <p className={cx(ui.errorText, "mt-4 inline-flex items-center gap-1.5")} role="alert">
          <AlertTriangle size={16} aria-hidden /> {error}
        </p>
      ) : null}
    </div>
  );
}
