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

async function downloadDocument(
  url: string,
  signal: AbortSignal,
  onTick: (loaded: number, total: number) => void
): Promise<Uint8Array> {
  const response = await fetch(url, {
    signal,

    credentials: isSameOrigin(url) ? "include" : "omit"
  });
  if (!response.ok) {
    throw new Error(`The document could not be downloaded (${response.status}).`);
  }

  const declared = Number(response.headers.get("Content-Length") ?? 0);
  const total = Number.isFinite(declared) && declared > 0 ? declared : 0;

  if (!response.body) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    onTick(buffer.byteLength, buffer.byteLength);
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (; ;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    loaded += value.byteLength;
    onTick(loaded, total);
  }

  const complete = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    complete.set(chunk, offset);
    offset += chunk.byteLength;
  }
  onTick(loaded, loaded);
  return complete;
}

interface DocumentState {
  url: string;
  pdf: PDFDocumentProxy | null;
  error: string | null;
}

export function usePdfDocument(
  fileUrl: string,
  onLoaded?: () => void,
  onProgress?: (progress: PdfLoadProgress) => void,
  onExpired?: () => void
) {
  const [state, setState] = useState<DocumentState>({
    url: fileUrl,
    pdf: null,
    error: null
  });
  const onLoadedRef = useRef(onLoaded);
  const onProgressRef = useRef(onProgress);
  const onExpiredRef = useRef(onExpired);
  // Re-sign at most once per URL, so a genuinely broken document can't loop.
  const refreshedRef = useRef<string | null>(null);

  useEffect(() => {
    onLoadedRef.current = onLoaded;
    onProgressRef.current = onProgress;
    onExpiredRef.current = onExpired;
  });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    let task: ReturnType<typeof pdfjs.getDocument> | null = null;

    void (async () => {
      try {
        const data = await downloadDocument(
          fileUrl,
          controller.signal,
          (loaded, total) => {
            if (cancelled) return;
            const ratio = total > 0 ? Math.min(1, loaded / total) : null;
            onProgressRef.current?.({ loaded, total, ratio });
          }
        );
        if (cancelled) return;

        task = pdfjs.getDocument({ data, wasmUrl: pdfjsWasmUrl });
        const doc = await task.promise;
        if (cancelled) {
          void doc.destroy();
          return;
        }
        setState({ url: fileUrl, pdf: doc, error: null });
        onLoadedRef.current?.();
      } catch (cause: unknown) {
        if (cancelled) return;
        // A stale signed URL fails the same way a missing one does; ask for a
        // fresh one before deciding the document is actually broken.
        if (refreshedRef.current !== fileUrl && onExpiredRef.current) {
          refreshedRef.current = fileUrl;
          onExpiredRef.current();
          return;
        }
        setState({
          url: fileUrl,
          pdf: null,
          error: cause instanceof Error ? cause.message : "PDF failed to load."
        });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      void task?.destroy();
    };
  }, [fileUrl]);


  const settled = state.url === fileUrl ? state : null;
  return { pdf: settled?.pdf ?? null, error: settled?.error ?? null };
}
