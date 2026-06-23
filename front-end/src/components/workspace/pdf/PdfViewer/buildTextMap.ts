import type { TextItem } from "pdfjs-dist/types/src/display/api";

/**
 * One placed glyph-run inside a page, plus its mapping back to the normalised
 * page-text string the backend produced. `start`..`end` are exclusive offsets
 * into that string — the same offsets a citation carries.
 */
export interface PlacedTextItem {
  /** Visible text of this run. */
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
 * A run carrying both its screen-space rect (for painting) and the raw PDF
 * user-space geometry the backend uses to decide reading order.
 */
interface OrderedRun {
  rawText: string;
  rect: Omit<PlacedTextItem, "text" | "start" | "end">;
  /** PDF user-space baseline y (grows upward) — used for line grouping. */
  rawY: number;
  /** PDF user-space x — used for left→right ordering within a line. */
  rawX: number;
  /** PDF user-space glyph height — drives the line-grouping tolerance. */
  rawHeight: number;
}

/**
 * Rebuilds the page text EXACTLY as the backend's `itemsToLayoutText` +
 * `normalizeLayoutText` do, and emits per-run character-offset spans so we can
 * paint highlights driven by backend-supplied citation offsets.
 *
 * The backend no longer concatenates runs in content-stream order. It now
 * reconstructs true VISUAL reading order from each run's position (group runs
 * into lines by baseline `y` top→bottom, sort each line left→right by `x`), then
 * normalises whitespace while KEEPING newlines. Citation offsets are measured
 * against that string, so the front-end MUST reproduce the same pipeline
 * byte-for-byte or highlights land on the wrong glyphs. Keep this in lockstep
 * with back-end/.../pdfjs-text-extractor.ts.
 */
export function buildTextMap(
  items: ReadonlyArray<TextItem>,
  viewport: { transform: number[]; height: number; width: number; scale: number }
): { pageText: string; placed: PlacedTextItem[] } {
  const runs: OrderedRun[] = [];
  for (const item of items) {
    // Backend drops empty-string runs (`if (!run.str) continue`); whitespace-
    // only runs are kept. Mirror that so the join separators line up.
    const raw = item.str ?? "";
    if (!raw) continue;
    if (!Array.isArray(item.transform) || item.transform.length < 6) continue;
    const canonical = raw.normalize("NFKC");

    // Project the PDF transform through the viewport to get the screen-space box.
    // Mirrors pdf.js's own text-layer math: the baseline sits at (tx4, tx5), the
    // glyph height equals `hypot(tx2, tx3)` (font scale × viewport scale), and
    // the horizontal extent comes from `item.width × viewport.scale` —
    // `item.width` is already measured in user space with the font scale baked
    // in, so multiplying by the combined transform here would apply the font
    // scale twice and the highlight would shoot past the visible text.
    const transform = pdfjs_util_transform(viewport.transform, item.transform);
    const fontHeight = Math.hypot(transform[2] ?? 0, transform[3] ?? 1);

    runs.push({
      rawText: canonical,
      rect: {
        x: transform[4]!,
        y: transform[5]! - fontHeight,
        width: item.width * viewport.scale,
        height: fontHeight,
        rotation: Math.atan2(transform[1] ?? 0, transform[0] ?? 1)
      },
      // Reading order is decided in RAW PDF user space, identical to the backend
      // (`PositionedItem` uses `transform[5]`/`transform[4]`/`item.height`).
      rawY: item.transform[5]!,
      rawX: item.transform[4]!,
      rawHeight: item.height ?? Math.abs(item.transform[3] ?? 0)
    });
  }

  // Build the combined string in visual reading order, tracking each run's slice.
  const lines = orderIntoLines(runs);
  let combined = "";
  const ordered: { rect: OrderedRun["rect"]; start: number; end: number }[] = [];
  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) combined += "\n";
    line.forEach((run, runIndex) => {
      if (runIndex > 0) combined += " ";
      const start = combined.length;
      combined += run.rawText;
      ordered.push({ rect: run.rect, start, end: combined.length });
    });
  });

  // Normalise exactly like `normalizeLayoutText`, then rewrite every run's
  // offsets onto the normalised string.
  const { normalized, offsetMap } = normalizeLayoutTrackingOffsets(combined);
  const placed = ordered
    .map((run) => {
      const newStart = offsetMap[run.start];
      const newEnd =
        run.end === 0
          ? 0
          : offsetMap[run.end - 1] !== undefined
            ? offsetMap[run.end - 1]! + 1
            : normalized.length;
      if (newStart === undefined || newStart >= newEnd) {
        return null;
      }
      return {
        text: combined.slice(run.start, run.end),
        start: newStart,
        end: newEnd,
        ...run.rect
      } satisfies PlacedTextItem;
    })
    .filter((item): item is PlacedTextItem => item !== null);

  return { pageText: normalized, placed };
}

/**
 * Groups runs into top-to-bottom, left-to-right reading order — a direct mirror
 * of the backend's `positionedItemsToText`. Runs whose baselines fall within a
 * height-scaled vertical tolerance form one line; lines emit top→bottom (PDF `y`
 * grows upward, so we sort descending) and each line's runs left→right.
 */
function orderIntoLines(runs: OrderedRun[]): OrderedRun[][] {
  if (runs.length === 0) return [];

  const byTop = [...runs].sort((a, b) => b.rawY - a.rawY);
  const lines: OrderedRun[][] = [];
  for (const run of byTop) {
    const current = lines[lines.length - 1];
    const reference = current?.[0];
    const tolerance = Math.max(2, (reference?.rawHeight ?? run.rawHeight) * 0.5);
    if (current && reference && Math.abs(reference.rawY - run.rawY) <= tolerance) {
      current.push(run);
    } else {
      lines.push([run]);
    }
  }
  for (const line of lines) {
    const text = line.map((run) => run.rawText).join("");
    if (isRightToLeft(text)) {
      line.sort((a, b) => b.rawX - a.rawX);
    } else {
      line.sort((a, b) => a.rawX - b.rawX);
    }
  }
  return lines;
}

/** Strong RTL characters: Arabic and Hebrew, base and presentation blocks. */
const RTL_CHARS = /[\u0590-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/g;
/** Strong LTR letters: Latin, Greek, Cyrillic, and CJK (all read left→right). */
const LTR_CHARS = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u3040-\u30FF\u3400-\u9FFF]/g;

/** A line reads right-to-left when its strong RTL chars outnumber its LTR ones. */
function isRightToLeft(text: string): boolean {
  const rtl = text.match(RTL_CHARS)?.length ?? 0;
  const ltr = text.match(LTR_CHARS)?.length ?? 0;
  return rtl > ltr;
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
 * Reproduces the backend's `normalizeLayoutText` with a parallel offset map.
 * The backend applies, in order: collapse runs of spaces/tabs (NOT newlines) to
 * one space; drop spaces hugging a newline; cap blank-line runs at one (≤2
 * newlines); trim the ends. We emulate the net effect in one pass so that
 * `offsetMap[i]` gives the normalised index of original character `i`.
 */
function normalizeLayoutTrackingOffsets(value: string): {
  normalized: string;
  offsetMap: number[];
} {
  let normalized = "";
  const offsetMap: number[] = new Array(value.length);
  let started = false; // have we emitted any non-whitespace yet (leading trim)

  // Pending whitespace run, resolved lazily so newline/space adjacency and the
  // blank-line cap can be decided without emit-then-pop.
  let pendingKind: "none" | "space" | "newline" = "none";
  let pendingNewlines = 0;
  let pendingIndices: number[] = [];

  const flushPending = (): void => {
    if (pendingKind === "none") return;
    if (started) {
      const at = normalized.length;
      if (pendingKind === "newline") {
        normalized += "\n".repeat(Math.min(pendingNewlines, 2));
      } else {
        normalized += " ";
      }
      for (const idx of pendingIndices) offsetMap[idx] = at;
    } else {
      // Leading whitespace is trimmed away.
      for (const idx of pendingIndices) offsetMap[idx] = normalized.length;
    }
    pendingKind = "none";
    pendingNewlines = 0;
    pendingIndices = [];
  };

  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i]!;
    if (/\s/.test(ch)) {
      pendingIndices.push(i);
      if (ch === "\n") {
        // A newline anywhere in the run wins: spaces hugging it are dropped.
        pendingKind = "newline";
        pendingNewlines += 1;
      } else if (pendingKind === "none") {
        pendingKind = "space";
      }
      continue;
    }
    flushPending();
    offsetMap[i] = normalized.length;
    normalized += ch;
    started = true;
  }

  // Trailing whitespace is trimmed — map it to the end without emitting.
  if (pendingKind !== "none") {
    for (const idx of pendingIndices) offsetMap[idx] = normalized.length;
  }

  return { normalized, offsetMap };
}
