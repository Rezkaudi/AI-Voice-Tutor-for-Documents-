import type { MutableRefObject } from "react";
import type { DocumentCitation } from "@/lib/types";
import { citationKey } from "@/store/documentStore";
import type { PlacedTextItem } from "./buildTextMap";


interface HighlightBox {
  key: string;
  rect: PlacedTextItem;
}


interface HighlightLayerProps {
  placed: PlacedTextItem[];
  highlights: DocumentCitation[];
  focusRef: MutableRefObject<HTMLDivElement | null>;
  focusCitationKey: string | null;
}


/** Collects the text runs that overlap the *focused* citation's [start, end) range. */
function collectBoxes(
  placed: PlacedTextItem[],
  highlights: DocumentCitation[],
  focusCitationKey: string | null
): HighlightBox[] {
  const citation = highlights.find((c) => citationKey(c) === focusCitationKey);
  if (!citation) return [];


  const boxes: HighlightBox[] = [];
  placed.forEach((item, i) => {
    if (item.end <= citation.start || item.start >= citation.end) return;
    boxes.push({ key: `${i}`, rect: item });
  });
  return boxes;
}


/**
 * Paints the PDF text runs inside the *currently focused* citation only, so a
 * single passage is highlighted at a time and tracks the sentence the teacher
 * is speaking. Boxes use a translucent yellow underlay so the canvas glyphs
 * remain crisp — same effect NotebookLM uses.
 */
export function HighlightLayer({
  placed,
  highlights,
  focusRef,
  focusCitationKey
}: HighlightLayerProps) {
  const boxes = collectBoxes(placed, highlights, focusCitationKey);
  if (!boxes.length) return null;


  return (
    <div className="pointer-events-none absolute inset-0">
      {boxes.map((box, index) => (
        <div
          key={box.key}
          ref={index === 0 ? focusRef : undefined}
          className="absolute rounded-[3px] transition-colors duration-200"
          style={{
            left: box.rect.x,
            top: box.rect.y,
            width: box.rect.width,
            height: box.rect.height,
            background: "oklch(0.88 0.16 95 / 0.55)",
            boxShadow: "0 0 0 1px oklch(0.78 0.18 80 / 0.55)",
            mixBlendMode: "multiply"
          }}
        />
      ))}
    </div>
  );
}
