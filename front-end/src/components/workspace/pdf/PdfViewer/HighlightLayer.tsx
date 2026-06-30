import type { MutableRefObject } from "react";
import type { DocumentCitation } from "@/types";
import { citationKey } from "@/store/documentStore";
import type { PlacedTextItem } from "./buildTextMap";

interface HighlightBox {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface HighlightLayerProps {
  placed: PlacedTextItem[];
  highlights: DocumentCitation[];
  focusRef: MutableRefObject<HTMLDivElement | null>;
  focusCitationKey: string | null;
}


/** Strong RTL characters: Arabic and Hebrew, base and presentation blocks. */
const RTL_CHARS = /[֐-ۿݐ-ݿࢠ-ࣿיִ-﷿ﹰ-﻿]/g;
/** Strong LTR letters: Latin, Greek, Cyrillic, and CJK (all read left→right). */
const LTR_CHARS = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ぀-ヿ㐀-鿿]/g;

function isRightToLeft(text: string): boolean {
  const rtl = text.match(RTL_CHARS)?.length ?? 0;
  const ltr = text.match(LTR_CHARS)?.length ?? 0;
  return rtl > ltr;
}

function clipRunToCitation(
  item: PlacedTextItem,
  citation: DocumentCitation
): Omit<HighlightBox, "key"> {
  const from = Math.max(item.start, citation.start);
  const to = Math.min(item.end, citation.end);
  const len = item.end - item.start;

  if (
    len <= 0 ||
    Math.abs(item.rotation) > 0.01 ||
    (from <= item.start && to >= item.end)
  ) {
    return { x: item.x, y: item.y, width: item.width, height: item.height };
  }

  const leadFrac = isRightToLeft(item.text)
    ? (item.end - to) / len
    : (from - item.start) / len;
  const spanFrac = (to - from) / len;

  return {
    x: item.x + item.width * leadFrac,
    y: item.y,
    width: item.width * spanFrac,
    height: item.height
  };
}

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
    boxes.push({ key: `${i}`, ...clipRunToCitation(item, citation) });
  });
  return boxes;
}

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
            left: box.x,
            top: box.y,
            width: box.width,
            height: box.height,
            background: "oklch(0.88 0.16 95 / 0.55)",
            boxShadow: "0 0 0 1px oklch(0.78 0.18 80 / 0.55)",
            mixBlendMode: "multiply"
          }}
        />
      ))}
    </div>
  );
}
