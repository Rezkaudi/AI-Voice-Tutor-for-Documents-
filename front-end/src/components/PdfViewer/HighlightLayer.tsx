import type { MutableRefObject } from "react";
import type { DocumentCitation } from "@/lib/types";
import type { PlacedTextItem } from "./buildTextMap";

interface HighlightBox {
  key: string;
  citationKey: string;
  isFocus: boolean;
  rect: PlacedTextItem;
}

interface HighlightLayerProps {
  placed: PlacedTextItem[];
  highlights: DocumentCitation[];
  focusRef: MutableRefObject<HTMLDivElement | null>;
  focusCitationKey: string | null;
}

/** Collects every text run that overlaps a citation's half-open [start, end) range. */
function collectBoxes(
  placed: PlacedTextItem[],
  highlights: DocumentCitation[],
  focusCitationKey: string | null
): HighlightBox[] {
  const boxes: HighlightBox[] = [];
  highlights.forEach((citation, citationIndex) => {
    const citationKey = `${citation.pageNumber}:${citation.start}:${citation.end}`;
    const isFocus = citationKey === focusCitationKey;
    placed.forEach((item, i) => {
      if (item.end <= citation.start || item.start >= citation.end) return;
      boxes.push({ key: `${citationIndex}-${i}`, citationKey, isFocus, rect: item });
    });
  });
  return boxes;
}

/**
 * Paints every PDF text run that falls inside a citation's offset range. Boxes
 * use a translucent yellow underlay so the canvas glyphs remain crisp — same
 * effect NotebookLM uses.
 */
export function HighlightLayer({
  placed,
  highlights,
  focusRef,
  focusCitationKey
}: HighlightLayerProps) {
  if (!highlights.length) return null;

  const boxes = collectBoxes(placed, highlights, focusCitationKey);

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
                ? "oklch(0.80 0.18 65 / 0.60)"
                : "oklch(0.94 0.10 100 / 0.68)",
              boxShadow: box.isFocus
                ? "0 0 0 1.5px oklch(0.68 0.20 55 / 0.85)"
                : "0 0 0 1px oklch(0.85 0.10 100 / 0.58)",
              mixBlendMode: "multiply"
            }}
          />
        );
      })}
    </div>
  );
}
