import type { TextItem } from "pdfjs-dist/types/src/display/api";

export interface PlacedTextItem {
  text: string;
  start: number;
  end: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

interface OrderedRun {
  rawText: string;
  rect: Omit<PlacedTextItem, "text" | "start" | "end">;
  rawY: number;
  rawX: number;
  rawHeight: number;
}

export function buildTextMap(
  items: ReadonlyArray<TextItem>,
  viewport: { transform: number[]; height: number; width: number; scale: number }
): { pageText: string; placed: PlacedTextItem[] } {
  const runs: OrderedRun[] = [];
  for (const item of items) {

    const raw = item.str ?? "";
    if (!raw) continue;
    if (!Array.isArray(item.transform) || item.transform.length < 6) continue;
    const canonical = raw.normalize("NFKC");

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

      rawY: item.transform[5]!,
      rawX: item.transform[4]!,
      rawHeight: item.height ?? Math.abs(item.transform[3] ?? 0)
    });
  }

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

function normalizeLayoutTrackingOffsets(value: string): {
  normalized: string;
  offsetMap: number[];
} {
  let normalized = "";
  const offsetMap: number[] = new Array(value.length);
  let started = false;

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

  if (pendingKind !== "none") {
    for (const idx of pendingIndices) offsetMap[idx] = normalized.length;
  }

  return { normalized, offsetMap };
}
