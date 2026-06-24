import { useEffect, useRef, useState } from "react";
import { pdfjs, pdfjsWasmUrl } from "@/lib/pdfWorker";
import type { PDFDocumentProxy } from "pdfjs-dist";

export function usePdfDocument(fileUrl: string, onLoaded?: () => void) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

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

  return { pdf, error };
}
