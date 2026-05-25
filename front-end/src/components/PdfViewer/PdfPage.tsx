import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { pdfjs } from "@/lib/pdfWorker";
import "pdfjs-dist/web/pdf_viewer.css";
import type {
  PDFDocumentProxy,
  RenderTask
} from "pdfjs-dist";
import type {
  TextItem,
  TextMarkedContent
} from "pdfjs-dist/types/src/display/api";
import type { DocumentCitation } from "@/lib/types";
import { buildTextMap, type PlacedTextItem } from "./buildTextMap";

interface PdfPageProps {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  /** Available pixel width for the page; height scales by aspect ratio. */
  fitWidth: number;
  /** Citations to highlight on this page (the parent already filtered by page). */
  highlights: DocumentCitation[];
  /** The citation whose first matched item should scroll into view. */
  focusCitationKey?: string | null;
}

interface RenderedPage {
  placed: PlacedTextItem[];
  cssWidth: number;
  cssHeight: number;
}

/**
 * Renders one PDF page as a canvas plus a hidden text layer plus an overlay
 * for citation highlights. Re-renders when the page or fit width changes.
 */
export function PdfPage({
  pdf,
  pageNumber,
  fitWidth,
  highlights,
  focusCitationKey
}: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const focusRef = useRef<HTMLDivElement | null>(null);
  const [rendered, setRendered] = useState<RenderedPage | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | null = null;
    let textLayer: { cancel: () => void } | null = null;
    let cleanupSelection: (() => void) | null = null;

    async function render(): Promise<void> {
      const page = await pdf.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = fitWidth / baseViewport.width;
      const viewport = page.getViewport({ scale });
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

      renderTask = page.render({ canvasContext: ctx, viewport });
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
      }

      // pdfjs's bare TextLayer paints absolutely-positioned spans but does NOT
      // wire up the selection-bounds behavior that lives in TextLayerBuilder.
      // Without these handlers + the .endOfContent element (which pdfjs already
      // appends), dragging across two spans selects every span in between in
      // DOM order — so a 2-line drag visually grabs the whole page. Toggling
      // the `selecting` class activates the pdf_viewer.css rules that clamp
      // selection to the cursor's actual region.
      const textContainerEl = textLayerRef.current;
      const onMouseDown = () => textContainerEl?.classList.add("selecting");
      const onMouseUp = () => textContainerEl?.classList.remove("selecting");
      textContainerEl?.addEventListener("mousedown", onMouseDown);
      document.addEventListener("mouseup", onMouseUp);
      cleanupSelection = () => {
        textContainerEl?.removeEventListener("mousedown", onMouseDown);
        document.removeEventListener("mouseup", onMouseUp);
      };

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

  useEffect(() => {
    if (focusCitationKey && focusRef.current) {
      focusRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [focusCitationKey, rendered]);

  const aspect = rendered ? rendered.cssHeight / rendered.cssWidth : 1.3;
  return (
    <div
      className="relative mx-auto"
      style={{
        width: fitWidth,
        height: Math.floor(fitWidth * aspect)
      }}
    >
      <canvas
        ref={canvasRef}
        className="block bg-white shadow-md"
        style={{ width: "100%", height: "100%" }}
      />
      {rendered ? (
        <HighlightLayer
          placed={rendered.placed}
          highlights={highlights}
          focusRef={focusRef}
          focusCitationKey={focusCitationKey ?? null}
        />
      ) : null}
      <div
        ref={textLayerRef}
        className="textLayer absolute inset-0"
        style={{ cursor: "text" }}
      />
    </div>
  );
}

interface HighlightLayerProps {
  placed: PlacedTextItem[];
  highlights: DocumentCitation[];
  focusRef: MutableRefObject<HTMLDivElement | null>;
  focusCitationKey: string | null;
}

/**
 * Paints every PDF text run that falls inside a citation's offset range. Boxes
 * use a translucent yellow underlay so the canvas glyphs remain crisp — same
 * effect NotebookLM uses.
 */
function HighlightLayer({
  placed,
  highlights,
  focusRef,
  focusCitationKey
}: HighlightLayerProps) {
  if (!highlights.length) return null;

  const boxes: Array<{
    key: string;
    citationKey: string;
    isFocus: boolean;
    rect: PlacedTextItem;
  }> = [];

  highlights.forEach((citation, citationIndex) => {
    const citationKey = `${citation.pageNumber}:${citation.start}:${citation.end}`;
    const isFocus = citationKey === focusCitationKey;
    for (let i = 0; i < placed.length; i += 1) {
      const item = placed[i]!;
      // Overlap test on half-open intervals [start, end).
      if (item.end <= citation.start || item.start >= citation.end) continue;
      boxes.push({
        key: `${citationIndex}-${i}`,
        citationKey,
        isFocus,
        rect: item
      });
    }
  });

  return (
    <div className="pointer-events-none absolute inset-0">
      {boxes.map((box, index) => {
        const isFirstOfFocus =
          box.isFocus &&
          boxes.findIndex((b) => b.citationKey === box.citationKey) === index;
        return (
          <div
            key={box.key}
            ref={isFirstOfFocus ? focusRef : undefined}
            className="absolute rounded-[3px] transition-colors duration-200"
            style={{
              left: box.rect.x,
              top: box.rect.y,
              width: box.rect.width,
              height: box.rect.height,
              background: box.isFocus
                ? "oklch(0.88 0.16 95 / 0.55)"
                : "oklch(0.92 0.13 95 / 0.42)",
              boxShadow: box.isFocus
                ? "0 0 0 1px oklch(0.78 0.18 80 / 0.55)"
                : "0 0 0 1px oklch(0.82 0.14 85 / 0.35)",
              mixBlendMode: "multiply"
            }}
          />
        );
      })}
    </div>
  );
}
