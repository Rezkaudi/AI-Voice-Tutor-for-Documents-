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
    <div className="grid h-full grid-rows-[auto_1fr] gap-2 min-[920px]:gap-3.5">
      <div
        className={cx(
          ui.surface,
          "flex items-center justify-between gap-2 px-3 py-1.5 min-[920px]:gap-3.5 min-[920px]:p-3"
        )}
      >
        <h2 className="m-0 truncate text-[0.95rem] font-bold min-[920px]:text-base min-[920px]:font-semibold">
          Page {visiblePage}
        </h2>
        <div className="flex flex-none items-center gap-1.5 min-[920px]:gap-2.5">
          {onEditPages ? (
            <button
              className={cx(
                ui.button,
                "px-2.5! py-1.5! text-[0.85rem] min-[920px]:px-[13px]! min-[920px]:py-[9px]! min-[920px]:text-[1rem]"
              )}
              type="button"
              aria-label="Choose which pages to study"
              title="Choose which pages to study"
              onClick={onEditPages}
            >
              <BookOpen size={16} aria-hidden />
              <span className="max-[420px]:hidden">Teaching pages</span>
            </button>
          ) : null}
          {fileUrl ? (
            <a
              className={cx(ui.button, "px-2! py-1.5! min-[920px]:px-[13px]! min-[920px]:py-[9px]!")}
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Open document in a new tab"
              title="Open document in a new tab"
            >
              <ExternalLink size={16} aria-hidden />
            </a>
          ) : null}
        </div>
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
