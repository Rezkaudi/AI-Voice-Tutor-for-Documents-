import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

export const FALLBACK_ASPECT = 1.294;

export function usePageAspects(pdf: PDFDocumentProxy | null): number[] {
  const [aspects, setAspects] = useState<number[]>([]);

  useEffect(() => {
    if (!pdf) {
      setAspects([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const arr = new Array<number>(pdf.numPages).fill(FALLBACK_ASPECT);
      for (let i = 1; i <= pdf.numPages; i++) {
        if (cancelled) return;
        try {
          const p = await pdf.getPage(i);
          const vp = p.getViewport({ scale: 1 });
          arr[i - 1] = vp.height / vp.width;
        } catch { }
        if ((i % 4 === 0 || i === pdf.numPages) && !cancelled) setAspects(arr.slice());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdf]);

  return aspects;
}
