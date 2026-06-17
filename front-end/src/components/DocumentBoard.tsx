import { BookOpen, ExternalLink } from "lucide-react";
import { memo, useEffect, useState } from "react";
import { cx, ui } from "@/lib/uiClasses";
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
  onEditPages?: () => void;
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
  onFocusCitation,
  onEditPages
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
    <div className="grid h-full grid-rows-[auto_1fr] gap-3.5">
      <div className={cx(ui.surface, "flex flex-col gap-2.5 p-3")}>
        <div className="flex items-center justify-between gap-3.5 max-[560px]:flex-col max-[560px]:items-stretch">
          <div className="min-w-0">
            <h2 className="m-0 text-base">Page {visiblePage}</h2>
            {/* {citations.length > 0 && (
              <p className="mb-0 mt-1 text-[0.85rem] text-muted">
                {`${citations.length} cited passage${citations.length === 1 ? "" : "s"}`}
              </p>
            )} */}
          </div>
          <div className={cx(ui.buttonRow, "max-[560px]:justify-end")}>
            {onEditPages ? (
              <button
                className={ui.button}
                type="button"
                aria-label="Choose which pages to study"
                title="Choose which pages to study"
                onClick={onEditPages}
              >
                <BookOpen size={17} aria-hidden />
                Teaching pages
              </button>
            ) : null}
            {fileUrl ? (
              <a className={ui.button} href={fileUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={17} aria-hidden />
                {/* Open */}
              </a>
            ) : null}
          </div>
        </div>
        {/* {citations.length ? (
          <CitationChips
            citations={citations}
            activeKey={activeCitationKey}
            onPick={onFocusCitation}
          />
        ) : null} */}
      </div>
      <div
        className={cx(
          "relative min-h-0",
          isPdf ? "overflow-hidden p-0" : "overflow-auto p-[clamp(12px,2vw,22px)]"
        )}
      >
        {isPdf && fileUrl ? (
          <div className="relative h-full w-full overflow-hidden rounded-md border border-[oklch(0.82_0.016_86)] shadow-[0_16px_28px_oklch(0.25_0.018_245/0.1)]">
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
        {showOverlay ? <DocumentLoadingOverlay /> : null}
      </div>
    </div>
  );
}

export const DocumentBoard = memo(DocumentBoardComponent);
// Re-export so the parent can pass a stable focus callback into the chip click.
export { citationKey };
