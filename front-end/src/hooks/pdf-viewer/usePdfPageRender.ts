import { useEffect, useRef, useState } from "react";
import { pdfjs } from "@/lib/pdfWorker";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import type { TextItem, TextMarkedContent } from "pdfjs-dist/types/src/display/api";
import { buildTextMap, type PlacedTextItem } from "@/components/workspace/pdf/PdfViewer/buildTextMap";

export interface RenderedPage {
  placed: PlacedTextItem[];
  cssWidth: number;
  cssHeight: number;
}

function attachSelectionBounds(container: HTMLElement): () => void {
  const onMouseDown = () => container.classList.add("selecting");
  const onMouseUp = () => container.classList.remove("selecting");
  container.addEventListener("mousedown", onMouseDown);
  document.addEventListener("mouseup", onMouseUp);
  return () => {
    container.removeEventListener("mousedown", onMouseDown);
    document.removeEventListener("mouseup", onMouseUp);
  };
}

export function usePdfPageRender(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  fitWidth: number
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const [rendered, setRendered] = useState<RenderedPage | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | null = null;
    let textLayer: { cancel: () => void } | null = null;
    let cleanupSelection: (() => void) | null = null;

    async function render(): Promise<void> {
      const page = await pdf.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: fitWidth / baseViewport.width });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      renderTask = page.render({ canvas, canvasContext: ctx, viewport });
      await renderTask.promise.catch(() => null);
      if (cancelled) return;

      const content = await page.getTextContent();
      const items = (content.items as Array<TextItem | TextMarkedContent>)
        .filter((item): item is TextItem => "str" in item);
      const { placed } = buildTextMap(items, {
        transform: viewport.transform,
        width: viewport.width,
        height: viewport.height,
        scale: viewport.scale
      });
      if (cancelled) return;

      const textContainer = textLayerRef.current;
      if (textContainer) {
        textContainer.replaceChildren();
        textContainer.style.setProperty("--scale-factor", String(viewport.scale));
        textContainer.style.width = `${viewport.width}px`;
        textContainer.style.height = `${viewport.height}px`;
        const layer = new pdfjs.TextLayer({
          textContentSource: content,
          container: textContainer,
          viewport
        });
        textLayer = layer;
        layer.render().catch(() => null);
        cleanupSelection = attachSelectionBounds(textContainer);
      }

      setRendered({
        placed,
        cssWidth: viewport.width,
        cssHeight: viewport.height
      });
    }

    void render();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
      cleanupSelection?.();
    };
  }, [pdf, pageNumber, fitWidth]);

  return { canvasRef, textLayerRef, rendered };
}
