import { memo, useEffect, useState } from "react";
import { cx } from "@/lib/uiClasses";
import type { DocumentReference } from "@/lib/types";
import { citationKey } from "@/store/documentStore";
import { CitationChips } from "./CitationChips";
import { DocumentLoadingOverlay } from "./DocumentLoadingOverlay";
import { PdfViewer } from "./PdfViewer";

interface DocumentBoardProps {
  fileUrl: string | null;
  mimeType: string;
  pageCount: number;
  activePage: number;
  highlight: DocumentReference | null;
  activeCitationKey: string | null;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
  onFocusCitation: (citation: DocumentReference["citations"][number]) => void;
}

/**
 * Renders the source document with NotebookLM-style citation highlights.
 * PDFs use a PDF.js canvas + text-layer so we can paint coloured spans over
 * the citation offsets.
 */
function DocumentBoardComponent({
  fileUrl,
  mimeType,
  pageCount,
  activePage,
  highlight,
  activeCitationKey,
  isLoading = false,
  onFocusCitation
}: DocumentBoardProps) {
  const isPdf = mimeType === "application/pdf" && !!fileUrl;
  const [pdfLoading, setPdfLoading] = useState(isPdf);


  const [visiblePage, setVisiblePage] = useState(activePage);
  useEffect(() => {
    setVisiblePage(activePage);
  }, [activePage]);

  const citations = highlight?.citations ?? [];

  const showOverlay = isLoading || (isPdf && pdfLoading);

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
            onLoaded={() => setPdfLoading(false)}
            onVisiblePageChange={setVisiblePage}
          />
        </div>
      ) : (
        <div className="grid h-full place-items-center text-[0.9rem] text-muted">
          Loading PDF…
        </div>
      )}

      {/* Floating page indicator (bottom-left), overlaid on the document */}
      <span
        className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-md bg-[oklch(0.2_0.02_245/0.62)] px-2.5 py-1 text-[0.8rem] font-semibold text-white backdrop-blur-sm [-webkit-backdrop-filter:blur(4px)] max-[919px]:bottom-[calc(env(safe-area-inset-bottom)+24px)]"
        aria-live="polite"
      >
        Page {visiblePage}
      </span>

      {showOverlay ? <DocumentLoadingOverlay /> : null}
    </div>
  );
}

export const DocumentBoard = memo(DocumentBoardComponent);
// Re-export so the parent can pass a stable focus callback into the chip click.
export { citationKey };
