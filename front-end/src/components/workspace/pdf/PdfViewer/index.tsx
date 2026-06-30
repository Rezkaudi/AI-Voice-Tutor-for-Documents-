import { useEffect, useRef, useState } from "react";
import type { DocumentCitation } from "@/types";
import { PdfPage } from "./PdfPage";
import { usePdfDocument } from "@/hooks/pdf-viewer/usePdfDocument";
import { FALLBACK_ASPECT, usePageAspects } from "@/hooks/pdf-viewer/usePageAspects";
import { usePageWindowing } from "@/hooks/pdf-viewer/usePageWindowing";
import { useScrollSync } from "@/hooks/pdf-viewer/useScrollSync";

interface PdfViewerProps {
  fileUrl: string;
  page: number;
  citations: DocumentCitation[];
  focusCitationKey: string | null;
  onLoaded?: () => void;
  onVisiblePageChange?: (page: number) => void;
}

export function PdfViewer({
  fileUrl,
  page,
  citations,
  focusCitationKey,
  onLoaded,
  onVisiblePageChange
}: PdfViewerProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [fitWidth, setFitWidth] = useState(0);

  const { pdf, error } = usePdfDocument(fileUrl, onLoaded);
  const aspects = usePageAspects(pdf);

  const numPages = pdf?.numPages ?? 0;
  const docKey = pdf?.fingerprints?.[0] ?? "doc";

  useScrollSync(pdf, page, focusCitationKey, scrollRef, slotRefs, onVisiblePageChange);
  const renderSet = usePageWindowing(pdf, fitWidth, scrollRef, slotRefs, page, numPages);

  useEffect(() => {
    if (!scrollRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setFitWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(scrollRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={scrollRef}
      className="scrollbar-doc relative h-full w-full overflow-x-hidden overflow-y-auto bg-[oklch(0.92_0.012_86)] max-[919px]:scroll-pb-[136px] max-[919px]:pb-[calc(env(safe-area-inset-bottom)+136px)]"
    >
      {error ? (
        <div className="grid h-full place-items-center px-6 text-center text-sm text-muted">
          {error}
        </div>
      ) : null}
      {pdf && fitWidth > 0
        ? Array.from({ length: numPages }, (_, i) => {
          const pageNumber = i + 1;
          const aspect = aspects[i] ?? FALLBACK_ASPECT;
          const reserved = Math.floor(fitWidth * aspect);
          return (
            <div
              key={`${docKey}-${pageNumber}`}
              data-page={pageNumber}
              ref={(el) => {
                slotRefs.current[i] = el;
              }}
              className="mx-auto mb-3 last:mb-0"
              style={{ width: fitWidth, minHeight: reserved }}
            >
              {renderSet.has(pageNumber) ? (
                <PdfPage
                  pdf={pdf}
                  pageNumber={pageNumber}
                  fitWidth={fitWidth}
                  highlights={citations.filter((c) => c.pageNumber === pageNumber)}
                  focusCitationKey={focusCitationKey}
                />
              ) : null}
            </div>
          );
        })
        : null}
    </div>
  );
}
