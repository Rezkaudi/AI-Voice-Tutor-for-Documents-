import { BookOpen, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { memo, useState } from "react";
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
  onPageChange,
  onFocusCitation,
  onEditPages
}: DocumentBoardProps) {
  const isPdf = mimeType === "application/pdf" && !!fileUrl;
  const [pdfLoading, setPdfLoading] = useState(isPdf);
  const [pageInput, setPageInput] = useState("");

  const commitPageInput = () => {
    const parsed = Number.parseInt(pageInput, 10);
    if (Number.isFinite(parsed)) {
      const next = Math.min(pageCount, Math.max(1, parsed));
      if (next !== activePage) onPageChange(next);
    }
    setPageInput("");
  };

  const citations = highlight?.citations ?? [];
  const pageCitations = citations.filter((c) => c.pageNumber === activePage);

  const showOverlay = isLoading || (isPdf && pdfLoading);

  return (
    <div className="grid h-full grid-rows-[auto_1fr] gap-3.5">
      <div className={cx(ui.surface, "flex flex-col gap-2.5 p-3")}>
        <div className="flex items-center justify-between gap-3.5 max-[560px]:flex-col max-[560px]:items-stretch">
          <div className="min-w-0">
            <h2 className="m-0 text-base">Page {activePage}</h2>
            {/* {citations.length > 0 && (
              <p className="mb-0 mt-1 text-[0.85rem] text-muted">
                {`${citations.length} cited passage${citations.length === 1 ? "" : "s"}`}
              </p>
            )} */}
          </div>
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
          <div className={ui.buttonRow}>
            <button
              className={ui.iconButton}
              type="button"
              title="Previous page"
              disabled={activePage <= 1}
              onClick={() => onPageChange(Math.max(1, activePage - 1))}
            >
              <ChevronLeft size={18} aria-hidden />
            </button>
            <span className={cx(ui.pill, "gap-1")}>
              <input
                className="w-9 rounded border border-[oklch(0.82_0.016_86)] bg-transparent text-center text-inherit outline-none focus:border-[oklch(0.55_0.13_245)]"
                type="text"
                inputMode="numeric"
                aria-label="Go to page"
                title="Type a page number and press Enter"
                value={pageInput === "" ? String(activePage) : pageInput}
                onFocus={() => setPageInput(String(activePage))}
                onChange={(e) => setPageInput(e.target.value.replace(/[^\d]/g, ""))}
                onBlur={commitPageInput}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.blur();
                  } else if (e.key === "Escape") {
                    setPageInput("");
                    e.currentTarget.blur();
                  }
                }}
              />
              / {pageCount}
            </span>
            <button
              className={ui.iconButton}
              type="button"
              title="Next page"
              disabled={activePage >= pageCount}
              onClick={() => onPageChange(Math.min(pageCount, activePage + 1))}
            >
              <ChevronRight size={18} aria-hidden />
            </button>
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
              citations={pageCitations}
              focusCitationKey={activeCitationKey}
              onLoaded={() => setPdfLoading(false)}
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
