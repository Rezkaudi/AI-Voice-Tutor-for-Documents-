import { useEffect, useRef } from "react";
import "pdfjs-dist/web/pdf_viewer.css";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { DocumentCitation } from "@/lib/types";
import { HighlightLayer } from "./HighlightLayer";
import { usePdfPageRender } from "./usePdfPageRender";

interface PdfPageProps {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  /** Available pixel width for the page; height scales by aspect ratio. */
  fitWidth: number;
  /** Citations to highlight on this page (the parent already filtered by page). */
  highlights: DocumentCitation[];
  /** The citation whose first matched item should scroll into view. */
  focusCitationKey?: string | null;
}

/**
 * Renders one PDF page as a canvas plus a hidden text layer plus an overlay
 * for citation highlights. Re-renders when the page or fit width changes.
 */
export function PdfPage({
  pdf,
  pageNumber,
  fitWidth,
  highlights,
  focusCitationKey
}: PdfPageProps) {
  const focusRef = useRef<HTMLDivElement | null>(null);
  const { canvasRef, textLayerRef, rendered } = usePdfPageRender(
    pdf,
    pageNumber,
    fitWidth
  );

  useEffect(() => {
    if (focusCitationKey && focusRef.current) {
      focusRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [focusCitationKey, rendered]);

  const aspect = rendered ? rendered.cssHeight / rendered.cssWidth : 1.3;
  return (
    <div
      className="relative mx-auto"
      style={{ width: fitWidth, height: Math.floor(fitWidth * aspect) }}
    >
      <canvas
        ref={canvasRef}
        className="block bg-white shadow-md"
        style={{ width: "100%", height: "100%" }}
      />
      {rendered ? (
        <HighlightLayer
          placed={rendered.placed}
          highlights={highlights}
          focusRef={focusRef}
          focusCitationKey={focusCitationKey ?? null}
        />
      ) : null}
      <div
        ref={textLayerRef}
        className="textLayer absolute inset-0"
        style={{ cursor: "text" }}
      />
    </div>
  );
}
