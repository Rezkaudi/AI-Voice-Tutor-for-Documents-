import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "@/lib/uiClasses";
import type { DocumentReference } from "@/types";
import { citationKey } from "@/store/documentStore";
import { CitationChips } from "@/components/workspace/pdf/CitationChips";
import { PdfViewer } from "@/components/workspace/pdf/PdfViewer";

interface DocumentBoardProps {
  fileUrl: string | null;
  mimeType: string;
  pageCount: number;
  activePage: number;
  highlight: DocumentReference | null;
  activeCitationKey: string | null;
  onPageChange: (page: number) => void;
  onFocusCitation: (citation: DocumentReference["citations"][number]) => void;
  onReady?: () => void;
}

function DocumentBoardComponent({
  fileUrl,
  mimeType,
  pageCount,
  activePage,
  highlight,
  activeCitationKey,
  onFocusCitation,
  onReady
}: DocumentBoardProps) {
  const { t } = useTranslation();
  const isPdf = mimeType === "application/pdf" && !!fileUrl;

  const [visiblePage, setVisiblePage] = useState(activePage);
  useEffect(() => {
    setVisiblePage(activePage);
  }, [activePage]);

  useEffect(() => {
    if (!isPdf) onReady?.();
  }, [isPdf, onReady]);

  const citations = highlight?.citations ?? [];

  return (
    <div
      className={cx(
        "relative h-full min-h-0 bg-paper",
        isPdf
          ? "overflow-hidden p-0"
          : "overflow-auto p-[clamp(12px,2vw,22px)] max-[919px]:pb-[calc(env(safe-area-inset-bottom)+136px)]"
      )}
    >
      {isPdf && fileUrl ? (
        <div className="relative h-full w-full overflow-hidden">
          <PdfViewer
            fileUrl={fileUrl}
            page={activePage}
            citations={citations}
            focusCitationKey={activeCitationKey}
            onLoaded={() => onReady?.()}
            onVisiblePageChange={setVisiblePage}
          />
        </div>
      ) : (
        <div className="grid h-full place-items-center text-[0.9rem] text-muted">
          {t("workspace.loadingPdf")}
        </div>
      )}

      <span
        className="pointer-events-none absolute bottom-3 start-3 z-20 rounded-md bg-[oklch(0.2_0.02_245/0.62)] px-2.5 py-1 text-[0.8rem] font-semibold text-white backdrop-blur-sm [-webkit-backdrop-filter:blur(4px)] max-[919px]:bottom-[calc(env(safe-area-inset-bottom)+18px)]"
        aria-live="polite"
      >
        {t("workspace.page", { page: visiblePage })}
      </span>
    </div>
  );
}

export const DocumentBoard = memo(DocumentBoardComponent);

export { citationKey };
