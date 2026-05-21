import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { memo } from "react";
import { renderHighlightedText } from "@/lib/messageFormat";
import { cx, ui } from "@/lib/uiClasses";
import type { DocumentPage, DocumentReference } from "@/lib/types";

interface DocumentBoardProps {
  fileUrl: string | null;
  mimeType: string;
  page: DocumentPage | null;
  pageCount: number;
  activePage: number;
  highlight: DocumentReference | null;
  onPageChange: (page: number) => void;
}

/** Renders the source document — PDF in an iframe, or extracted page text. */
function DocumentBoardComponent({
  fileUrl,
  mimeType,
  page,
  pageCount,
  activePage,
  highlight,
  onPageChange
}: DocumentBoardProps) {
  const isPdf = mimeType === "application/pdf" && !!fileUrl;
  const pdfSrc = isPdf
    ? `${fileUrl}#page=${activePage}&view=FitH&toolbar=0&navpanes=0`
    : null;
  const highlightOnThisPage = highlight && highlight.pageNumber === page?.pageNumber;

  return (
    <div className="grid h-full grid-rows-[auto_1fr] gap-3.5">
      <div
        className={cx(
          ui.surface,
          "flex items-center justify-between gap-3.5 p-3 max-[560px]:flex-col max-[560px]:items-stretch"
        )}
      >
        <div className="min-w-0">
          <h2 className="m-0 text-base">Page {activePage}</h2>
          <p className="mb-0 mt-1 text-[0.85rem] text-muted">
            {highlight ? "Reference selected by the teacher" : "Original document"}
          </p>
        </div>
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
          <span className={ui.pill}>
            {activePage} / {pageCount}
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
              Open
            </a>
          ) : null}
        </div>
      </div>
      <div
        className={cx(
          "min-h-0",
          isPdf ? "overflow-hidden p-0" : "overflow-auto p-[clamp(12px,2vw,22px)]"
        )}
      >
        {isPdf ? (
          <div className="relative h-full w-full overflow-hidden rounded-md border border-[oklch(0.82_0.016_86)] bg-[oklch(0.92_0.012_86)] shadow-[0_16px_28px_oklch(0.25_0.018_245/0.1)]">
            <iframe
              key={activePage}
              src={pdfSrc ?? undefined}
              title={`Document page ${activePage}`}
              className="block h-full w-full border-0 bg-[oklch(0.94_0.01_86)]"
            />
          </div>
        ) : (
          <article className="mx-auto min-h-[min(980px,calc(100dvh-190px))] w-[min(100%,840px)] whitespace-pre-wrap rounded border border-[oklch(0.86_0.016_86)] bg-[oklch(0.994_0.006_92)] p-[clamp(22px,4vw,46px)] text-[clamp(0.95rem,1.3vw,1.05rem)] leading-[1.72] shadow-[0_16px_28px_oklch(0.25_0.018_245/0.1)]">
            {page
              ? renderHighlightedText(page.text, highlightOnThisPage ? highlight.snippet : null)
              : "No page text."}
          </article>
        )}
      </div>
    </div>
  );
}

export const DocumentBoard = memo(DocumentBoardComponent);
