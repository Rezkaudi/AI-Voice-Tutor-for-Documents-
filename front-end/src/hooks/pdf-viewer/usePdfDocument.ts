import { useEffect, useRef, useState } from "react";
import { pdfjs, pdfjsWasmUrl } from "@/lib/pdfWorker";
import type { PDFDocumentProxy } from "pdfjs-dist";

/** Byte-level load progress for the underlying PDF fetch. */
export interface PdfLoadProgress {
  loaded: number;
  total: number;
  ratio: number | null;
}

function isSameOrigin(url: string): boolean {
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

export function usePdfDocument(
  fileUrl: string,
  onLoaded?: () => void,
  onProgress?: (progress: PdfLoadProgress) => void
) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  useEffect(() => {
    let cancelled = false;
    let lastTotal = 0;
    setPdf(null);
    setError(null);
    const task = pdfjs.getDocument({
      url: fileUrl,
      withCredentials: isSameOrigin(fileUrl),
      wasmUrl: pdfjsWasmUrl,
      disableAutoFetch: true,
      rangeChunkSize: 262144
    });
    task.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
      if (cancelled) return;
      const safeTotal = typeof total === "number" && total > 0 ? total : 0;
      if (safeTotal > 0) lastTotal = safeTotal;
      const ratio = safeTotal > 0 ? Math.min(1, loaded / safeTotal) : null;
      onProgressRef.current?.({ loaded, total: safeTotal, ratio });
    };
    task.promise
      .then((doc) => {
        if (cancelled) {
          doc.destroy();
          return;
        }
        onProgressRef.current?.({ loaded: lastTotal, total: lastTotal, ratio: 1 });
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

  return { pdf, error };
}
