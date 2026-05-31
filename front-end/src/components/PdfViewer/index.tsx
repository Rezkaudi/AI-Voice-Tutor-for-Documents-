import { useEffect, useRef, useState } from "react";
import { pdfjs, pdfjsWasmUrl } from "@/lib/pdfWorker";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { DocumentCitation } from "@/lib/types";
import { PdfPage } from "./PdfPage";

interface PdfViewerProps {
  fileUrl: string;
  page: number;
  citations: DocumentCitation[];
  focusCitationKey: string | null;
  onLoaded?: () => void;
}

/**
 * Loads a PDF once and renders the active page with citation highlights. The
 * loader is keyed on `fileUrl` so swapping documents fully resets the state.
 */
export function PdfViewer({
  fileUrl,
  page,
  citations,
  focusCitationKey,
  onLoaded
}: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [fitWidth, setFitWidth] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // The loader keys on `fileUrl` only — `onLoaded` is read through a ref so
  // re-render-fresh parent callbacks don't kick off a re-fetch on every page
  // change. Without the ref, switching pages re-downloads the whole PDF.
  useEffect(() => {
    let cancelled = false;
    setPdf(null);
    setError(null);
    const task = pdfjs.getDocument({
      url: fileUrl,
      withCredentials: true,
      wasmUrl: pdfjsWasmUrl
    });
    task.promise
      .then((doc) => {
        if (cancelled) {
          doc.destroy();
          return;
        }
        setPdf(doc);
        onLoadedRef.current?.();
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "PDF failed to load.");
        }
      });
    return () => {
      cancelled = true;
      void task.destroy();
    };
  }, [fileUrl]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setFitWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const pageCitations = citations.filter((citation) => citation.pageNumber === page);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-x-hidden overflow-y-auto bg-[oklch(0.92_0.012_86)] p-3"
    >
      {error ? (
        <div className="grid h-full place-items-center px-6 text-center text-sm text-muted">
          {error}
        </div>
      ) : null}
      {pdf && fitWidth > 0 ? (
        <PdfPage
          key={pdf.fingerprints?.[0] ?? "doc"}
          pdf={pdf}
          pageNumber={page}
          fitWidth={fitWidth}
          highlights={pageCitations}
          focusCitationKey={focusCitationKey}
        />
      ) : null}
    </div>
  );
}
