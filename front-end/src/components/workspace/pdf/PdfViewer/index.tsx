import { useEffect, useMemo, useRef, useState } from "react";
import { pdfjs, pdfjsWasmUrl } from "@/lib/pdfWorker";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { DocumentCitation } from "@/types";
import { PdfPage } from "./PdfPage";

interface PdfViewerProps {
  fileUrl: string;
  page: number;
  citations: DocumentCitation[];
  focusCitationKey: string | null;
  onLoaded?: () => void;
  onVisiblePageChange?: (page: number) => void;
}

/** US Letter height/width — reserves space before a page's size is measured. */
const FALLBACK_ASPECT = 1.294;

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
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;
  const onVisibleRef = useRef(onVisiblePageChange);
  onVisibleRef.current = onVisiblePageChange;

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [fitWidth, setFitWidth] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [aspects, setAspects] = useState<number[]>([]);
  const [mounted, setMounted] = useState<Set<number>>(() => new Set());

  // The page currently filling the viewport. Kept in a ref so the `page`-driven
  // scroll effect can tell an external change from one we caused by scrolling,
  // which is what stops the two from fighting each other.
  const dominantRef = useRef(page);

  // The loader keys on `fileUrl` only — `onLoaded` is read through a ref so
  // re-render-fresh parent callbacks don't kick off a re-fetch on every page
  // change. Without the ref, switching pages re-downloads the whole PDF.
  useEffect(() => {
    let cancelled = false;
    setPdf(null);
    setError(null);
    setAspects([]);
    setMounted(new Set());
    slotRefs.current = [];
    dominantRef.current = page;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl]);

  useEffect(() => {
    if (!scrollRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setFitWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(scrollRef.current);
    return () => observer.disconnect();
  }, []);

  // Measure each page's aspect ratio up front (cheap metadata, no rasterising)
  // so reserved placeholder heights — and therefore the scrollbar — are correct
  // before the pages actually render.
  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    void (async () => {
      const arr = new Array<number>(pdf.numPages).fill(FALLBACK_ASPECT);
      for (let i = 1; i <= pdf.numPages; i++) {
        if (cancelled) return;
        try {
          const p = await pdf.getPage(i);
          const vp = p.getViewport({ scale: 1 });
          arr[i - 1] = vp.height / vp.width;
        } catch {
          /* keep the fallback aspect for this page */
        }
        if ((i % 4 === 0 || i === pdf.numPages) && !cancelled) setAspects(arr.slice());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdf]);

  // Window the expensive page rendering to the slots near the viewport.
  useEffect(() => {
    const root = scrollRef.current;
    if (!pdf || !root || fitWidth <= 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        setMounted((prev) => {
          let next = prev;
          let cloned = false;
          const ensureClone = () => {
            if (!cloned) {
              next = new Set(prev);
              cloned = true;
            }
          };
          for (const entry of entries) {
            const pn = Number((entry.target as HTMLElement).dataset.page);
            if (!pn) continue;
            if (entry.isIntersecting && !next.has(pn)) {
              ensureClone();
              next.add(pn);
            } else if (!entry.isIntersecting && next.has(pn)) {
              ensureClone();
              next.delete(pn);
            }
          }
          return cloned ? next : prev;
        });
      },
      { root, rootMargin: "200% 0px", threshold: 0 }
    );
    for (const el of slotRefs.current) if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [pdf, fitWidth]);

  // Report the page that owns the viewport's vertical centre as the user
  // scrolls, throttled to one read per frame.
  useEffect(() => {
    const root = scrollRef.current;
    if (!pdf) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const mid = root!.scrollTop + root!.clientHeight / 2;
      const slots = slotRefs.current;
      let best = 1;
      for (let i = 0; i < slots.length; i++) {
        const el = slots[i];
        if (!el) continue;
        if (el.offsetTop <= mid) best = i + 1;
        else break;
      }
      if (best !== dominantRef.current) {
        dominantRef.current = best;
        onVisibleRef.current?.(best);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    root!.addEventListener("scroll", onScroll, { passive: true });
    measure();
    return () => {
      root!.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [pdf]);

  // Scroll to `page` when it changes from outside. The dominant-page guard means
  // a change we already caused by scrolling never triggers a counter-scroll.
  useEffect(() => {
    if (!pdf) return;
    const root = scrollRef.current;
    const el = slotRefs.current[page - 1];
    if (!root || !el) return;
    if (focusCitationKey) {
      if (page !== dominantRef.current) {
        dominantRef.current = page;
        root.scrollTo({ top: el.offsetTop });
      }
      return;
    }

    if (page === dominantRef.current) return;
    dominantRef.current = page;
    root.scrollTo({ top: el.offsetTop, behavior: "smooth" });
  }, [pdf, page, focusCitationKey]);

  const numPages = pdf?.numPages ?? 0;
  const docKey = pdf?.fingerprints?.[0] ?? "doc";

  // Always render the target page (and its neighbours) even before the observer
  // catches up, so an external jump to a far page has something to scroll to.
  const renderSet = useMemo(() => {
    const set = new Set(mounted);
    for (let p = page - 1; p <= page + 1; p++) {
      if (p >= 1 && p <= numPages) set.add(p);
    }
    return set;
  }, [mounted, page, numPages]);

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
