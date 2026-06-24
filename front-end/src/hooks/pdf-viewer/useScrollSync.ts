import { useEffect, useRef, type RefObject } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

export function useScrollSync(
  pdf: PDFDocumentProxy | null,
  page: number,
  focusCitationKey: string | null,
  scrollRef: RefObject<HTMLDivElement | null>,
  slotRefs: RefObject<(HTMLDivElement | null)[]>,
  onVisiblePageChange?: (page: number) => void
): void {
  const dominantRef = useRef(page);
  const onVisibleRef = useRef(onVisiblePageChange);
  onVisibleRef.current = onVisiblePageChange;

  // A freshly-loaded document starts from its requested page.
  useEffect(() => {
    dominantRef.current = page;
  }, [pdf]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!pdf || !root) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const mid = root.scrollTop + root.clientHeight / 2;
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
    root.addEventListener("scroll", onScroll, { passive: true });
    measure();
    return () => {
      root.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [pdf, scrollRef, slotRefs]);

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
  }, [pdf, page, focusCitationKey, scrollRef, slotRefs]);
}
