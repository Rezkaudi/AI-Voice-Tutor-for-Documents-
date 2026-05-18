import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { memo } from "react";
import { renderHighlightedText } from "@/lib/message-format";
import type { DocumentPage, Reference } from "@/lib/types";

type DocumentBoardProps = {
  fileUrl: string | null;
  mimeType: string;
  page: DocumentPage | null;
  pageCount: number;
  activePage: number;
  highlight: Reference | null;
  onPageChange: (page: number) => void;
};

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
    <div className="document-board">
      <div className="board-toolbar surface">
        <div className="board-title">
          <h2>Page {activePage}</h2>
          <p>{highlight ? "Reference selected by the teacher" : "Original document"}</p>
        </div>
        <div className="button-row">
          <button
            className="icon-button"
            type="button"
            title="Previous page"
            disabled={activePage <= 1}
            onClick={() => onPageChange(Math.max(1, activePage - 1))}
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <span className="pill">
            {activePage} / {pageCount}
          </span>
          <button
            className="icon-button"
            type="button"
            title="Next page"
            disabled={activePage >= pageCount}
            onClick={() => onPageChange(Math.min(pageCount, activePage + 1))}
          >
            <ChevronRight size={18} aria-hidden />
          </button>
          {fileUrl ? (
            <a className="button" href={fileUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={17} aria-hidden />
              Open
            </a>
          ) : null}
        </div>
      </div>
      <div className="page-shell">
        {isPdf ? (
          <div className="pdf-frame">
            <iframe
              key={activePage}
              src={pdfSrc ?? undefined}
              title={`Document page ${activePage}`}
              className="pdf-iframe"
            />
          </div>
        ) : (
          <article className="page-paper">
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
