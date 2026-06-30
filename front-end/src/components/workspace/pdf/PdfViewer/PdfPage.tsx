import { useEffect, useRef } from "react";
import "pdfjs-dist/web/pdf_viewer.css";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { DocumentCitation } from "@/types";
import { HighlightLayer } from "./HighlightLayer";
import { scrollIntoContainerCenter } from "./scrollIntoContainer";
import { usePdfPageRender } from "@/hooks/pdf-viewer/usePdfPageRender";

interface PdfPageProps {
  pdf: PDFDocumentProxy;
  pageNumber: number;

  fitWidth: number;

  highlights: DocumentCitation[];

  focusCitationKey?: string | null;
}

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
      scrollIntoContainerCenter(focusRef.current);
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
