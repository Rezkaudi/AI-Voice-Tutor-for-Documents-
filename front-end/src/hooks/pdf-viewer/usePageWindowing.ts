import { useEffect, useMemo, useState, type RefObject } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

export function usePageWindowing(
  pdf: PDFDocumentProxy | null,
  fitWidth: number,
  scrollRef: RefObject<HTMLDivElement | null>,
  slotRefs: RefObject<(HTMLDivElement | null)[]>,
  page: number,
  numPages: number
): Set<number> {
  const [mounted, setMounted] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    setMounted(new Set());
  }, [pdf]);

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
  }, [pdf, fitWidth, scrollRef, slotRefs]);

  return useMemo(() => {
    const set = new Set(mounted);
    for (let p = page - 1; p <= page + 1; p++) {
      if (p >= 1 && p <= numPages) set.add(p);
    }
    return set;
  }, [mounted, page, numPages]);
}
