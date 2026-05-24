import type { TextItem } from "pdfjs-dist/types/src/display/api";

/**
 * One placed glyph-run inside a page, plus its mapping back to the normalised
 * page-text string the backend produced. `start`..`end` are exclusive offsets
 * into that string — the same offsets a citation carries.
 */
export interface PlacedTextItem {
  /** Visible text of this run (whitespace-collapsed). */
  text: string;
  /** Inclusive start offset in the normalised page string. */
  start: number;
  /** Exclusive end offset in the normalised page string. */
  end: number;
  /** Position on the PDF page in user-space units (origin top-left). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Rotation in radians; usually 0 for body text. */
  rotation: number;
}

/**
 * Mirrors the backend's `items.map(i => i.str).join(" ")` + whitespace-collapse
 * step exactly, and emits per-item character-offset spans so we can paint
 * highlights driven by backend-supplied citation offsets.
 *
 * The backend joins every text item with a single space and then collapses all
 * whitespace runs to one space (`normalizeText`). We reproduce that pipeline,
 * tracking each item's slice in the final string.
 */
export function buildTextMap(
  items: ReadonlyArray<TextItem>,
  viewport: { transform: number[]; height: number; width: number; scale: number }
): { pageText: string; placed: PlacedTextItem[] } {
  const placed: PlacedTextItem[] = [];
  let combined = "";

  for (const item of items) {
    const raw = item.str ?? "";
    if (!raw) {
      // Preserve the join separator so offsets stay aligned with the backend.
      if (combined.length > 0 && !combined.endsWith(" ")) combined += " ";
      continue;
    }
    if (combined.length > 0 && !combined.endsWith(" ")) {
      combined += " ";
    }
    const start = combined.length;
    combined += raw;
    const end = combined.length;

    // Project the PDF transform through the viewport to get screen-space box.
    // Mirrors pdf.js's own text-layer math: the baseline sits at (tx4, tx5),
    // the glyph height equals `hypot(tx2, tx3)` (font scale × viewport scale),
    // and the horizontal extent comes from `item.width × viewport.scale` —
    // `item.width` is already measured in user space with the font scale
    // baked in, so multiplying by the combined transform here would apply the
    // font scale twice and the highlight would shoot past the visible text.
    const transform = pdfjs_util_transform(viewport.transform, item.transform);
    const fontHeight = Math.hypot(transform[2] ?? 0, transform[3] ?? 1);
    const x = transform[4]!;
    const yTop = transform[5]! - fontHeight;
    const width = item.width * viewport.scale;
    const height = fontHeight;
    const rotation = Math.atan2(transform[1] ?? 0, transform[0] ?? 1);

    placed.push({
      text: raw,
      start,
      end,
      x,
      y: yTop,
      width,
      height,
      rotation
    });
  }

  // Now collapse whitespace exactly like `normalizeText` does, and rewrite
  // every placed item's offsets onto the collapsed string.
  const { normalized, offsetMap } = collapseTrackingOffsets(combined);
  const adjusted = placed
    .map((item) => {
      const newStart = offsetMap[item.start];
      const newEnd =
        item.end === 0
          ? 0
          : offsetMap[item.end - 1] !== undefined
            ? offsetMap[item.end - 1]! + 1
            : normalized.length;
      if (newStart === undefined || newStart >= newEnd) {
        return null;
      }
      return { ...item, start: newStart, end: newEnd };
    })
    .filter((item): item is PlacedTextItem => item !== null);

  return { pageText: normalized, placed: adjusted };
}

/** Computes the 2x3 transform `a * b` (column-vector convention) like pdf.js. */
function pdfjs_util_transform(a: number[], b: number[]): number[] {
  return [
    (a[0] ?? 1) * (b[0] ?? 1) + (a[2] ?? 0) * (b[1] ?? 0),
    (a[1] ?? 0) * (b[0] ?? 1) + (a[3] ?? 1) * (b[1] ?? 0),
    (a[0] ?? 1) * (b[2] ?? 0) + (a[2] ?? 0) * (b[3] ?? 1),
    (a[1] ?? 0) * (b[2] ?? 0) + (a[3] ?? 1) * (b[3] ?? 1),
    (a[0] ?? 1) * (b[4] ?? 0) + (a[2] ?? 0) * (b[5] ?? 0) + (a[4] ?? 0),
    (a[1] ?? 0) * (b[4] ?? 0) + (a[3] ?? 1) * (b[5] ?? 0) + (a[5] ?? 0)
  ];
}

/**
 * Collapses every whitespace run in `value` to a single space and returns a
 * parallel `offsetMap[i]` giving the new index of original-character `i`.
 * Characters dropped (extra whitespace) point at the surviving space's index.
 */
function collapseTrackingOffsets(value: string): {
  normalized: string;
  offsetMap: number[];
} {
  let normalized = "";
  const offsetMap: number[] = new Array(value.length);
  let inWs = true; // leading whitespace is trimmed
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i]!;
    if (/\s/.test(ch)) {
      if (!inWs && normalized.length > 0) {
        offsetMap[i] = normalized.length;
        normalized += " ";
        inWs = true;
      } else {
        offsetMap[i] = normalized.length;
      }
    } else {
      offsetMap[i] = normalized.length;
      normalized += ch;
      inWs = false;
    }
  }
  if (normalized.endsWith(" ")) {
    normalized = normalized.slice(0, -1);
  }
  return { normalized, offsetMap };
}
