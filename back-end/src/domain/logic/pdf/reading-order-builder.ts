import type { LayoutRegion, PositionedOcrItem } from "@/domain/logic/pdf/layout-region";

interface OrderedLine {
  items: PositionedOcrItem[];
  /** False for regions whose same-row cells should stay attached. */
  splittable: boolean;
}

/**
 * Reorders OCR items using layout regions so side-by-side columns are read
 * column-by-column instead of interleaved row-major.
 */
export class ReadingOrderBuilder {
  /** Page furniture that reads last regardless of the model's region order. */
  private static readonly TRAILING_LABELS = new Set(["footer", "number", "footnote"]);
  /** Regions whose rows must stay joined (cells relate across the row). */
  private static readonly ROW_BOUND_LABELS = new Set(["table", "chart", "figure", "image"]);
  /** Fraction of an item's area that must overlap a region to claim it. */
  private static readonly MIN_OVERLAP_RATIO = 0.3;
  /** If more than this fraction of items match no region, distrust the layout. */
  private static readonly MAX_ORPHAN_RATIO = 0.5;
  /** Horizontal tolerance (px) when clustering aligned column starts. */
  private static readonly COLUMN_TOLERANCE = 24;
  /** How far a line may poke past a seam before it counts as spanning it. */
  private static readonly SPAN_TOLERANCE = 48;
  /** A column seam must repeat across at least this many lines. */
  private static readonly MIN_COLUMN_LINES = 3;
  /** Tiny low-confidence OCR hits inside photos are usually visual noise. */
  private static readonly MAX_IMAGE_NOISE_CONFIDENCE = 0.75;
  /**
   * Text left of a seam must be sentence-length (width ≥ this × its height),
   * so list markers like "8." never spawn a column of their own.
   */
  private static readonly MIN_COLUMN_TEXT_RATIO = 4;

  /**
   * Groups OCR items into lines ordered by the layout model's reading order.
   * Returns null when the layout is unusable (no regions, or too many
   * orphans) so the caller can fall back to the OCR library's line order.
   */
  order(items: PositionedOcrItem[], regions: LayoutRegion[]): PositionedOcrItem[][] | null {
    if (items.length === 0 || regions.length === 0) return null;

    const buckets = regions.map<PositionedOcrItem[]>(() => []);
    const orphans: PositionedOcrItem[] = [];
    for (const item of items) {
      const index = this.assign(item, regions);
      if (index === null) {
        orphans.push(item);
      } else if (!this.isIgnorableImageNoise(item, regions[index]!)) {
        buckets[index]!.push(item);
      }
    }
    if (orphans.length / items.length > ReadingOrderBuilder.MAX_ORPHAN_RATIO) return null;

    const content: OrderedLine[] = [];
    const trailing: OrderedLine[] = [];
    regions.forEach((region, index) => {
      const splittable = this.isSplittableRegion(region, regions);
      const lines = this.groupIntoLines(buckets[index]!).map((line) => ({ items: line, splittable }));
      if (ReadingOrderBuilder.TRAILING_LABELS.has(region.label)) trailing.push(...lines);
      else content.push(...lines);
    });
    const orphanLines = this.groupIntoLines(orphans).map((line) => ({ items: line, splittable: true }));

    const ordered = [...this.readColumnwise([...content, ...orphanLines]), ...trailing];
    return ordered.map((line) => line.items);
  }

  private isSplittableRegion(region: LayoutRegion, regions: LayoutRegion[]): boolean {
    if (!ReadingOrderBuilder.ROW_BOUND_LABELS.has(region.label)) return true;
    return this.isTextColumnContainer(region, regions);
  }

  private isTextColumnContainer(region: LayoutRegion, regions: LayoutRegion[]): boolean {
    if (region.label !== "table") return false;

    const childStarts = regions
      .filter((other) =>
        other !== region &&
        !ReadingOrderBuilder.ROW_BOUND_LABELS.has(other.label) &&
        !ReadingOrderBuilder.TRAILING_LABELS.has(other.label) &&
        this.isInside(other, region)
      )
      .map((other) => other.x1)
      .sort((a, b) => a - b);

    let clusters = 0;
    let lastStart: number | null = null;
    for (const start of childStarts) {
      if (lastStart === null || start - lastStart > ReadingOrderBuilder.COLUMN_TOLERANCE) {
        clusters += 1;
        lastStart = start;
      }
    }
    return clusters >= 2;
  }

  private isInside(inner: LayoutRegion, outer: LayoutRegion): boolean {
    const tolerance = ReadingOrderBuilder.COLUMN_TOLERANCE;
    return (
      inner.x1 >= outer.x1 - tolerance &&
      inner.y1 >= outer.y1 - tolerance &&
      inner.x2 <= outer.x2 + tolerance &&
      inner.y2 <= outer.y2 + tolerance
    );
  }

  private isIgnorableImageNoise(item: PositionedOcrItem, region: LayoutRegion): boolean {
    return (
      region.label === "image" &&
      item.confidence <= ReadingOrderBuilder.MAX_IMAGE_NOISE_CONFIDENCE &&
      Array.from(item.text.trim()).length <= 1
    );
  }

  private assign(item: PositionedOcrItem, regions: LayoutRegion[]): number | null {
    const cx = item.x + item.width / 2;
    const cy = item.y + item.height / 2;

    let containing: number | null = null;
    let containingArea = Infinity;
    regions.forEach((region, index) => {
      if (cx < region.x1 || cx > region.x2 || cy < region.y1 || cy > region.y2) return;
      const area = (region.x2 - region.x1) * (region.y2 - region.y1);
      if (area < containingArea) {
        containing = index;
        containingArea = area;
      }
    });
    if (containing !== null) return containing;

    const itemArea = Math.max(1, item.width * item.height);
    let best: number | null = null;
    let bestOverlap = 0;
    regions.forEach((region, index) => {
      const width = Math.min(item.x + item.width, region.x2) - Math.max(item.x, region.x1);
      const height = Math.min(item.y + item.height, region.y2) - Math.max(item.y, region.y1);
      const overlap = Math.max(0, width) * Math.max(0, height);
      if (overlap > bestOverlap) {
        best = index;
        bestOverlap = overlap;
      }
    });
    if (best !== null && bestOverlap / itemArea >= ReadingOrderBuilder.MIN_OVERLAP_RATIO) {
      return best;
    }
    return null;
  }

  /** Clusters items into visual lines: top-to-bottom, then left-to-right. */
  private groupIntoLines(items: PositionedOcrItem[]): PositionedOcrItem[][] {
    if (items.length === 0) return [];

    const byTop = [...items].sort((a, b) => a.y + a.height / 2 - (b.y + b.height / 2));
    const lines: PositionedOcrItem[][] = [];
    let lineCenterSum = 0;
    let lineHeightSum = 0;
    for (const item of byTop) {
      const current = lines[lines.length - 1];
      const centerY = item.y + item.height / 2;
      if (current) {
        const lineCenter = lineCenterSum / current.length;
        const tolerance = Math.max(2, (lineHeightSum / current.length) * 0.5);
        if (Math.abs(centerY - lineCenter) <= tolerance) {
          current.push(item);
          lineCenterSum += centerY;
          lineHeightSum += item.height;
          continue;
        }
      }
      lines.push([item]);
      lineCenterSum = centerY;
      lineHeightSum = item.height;
    }
    for (const line of lines) line.sort((a, b) => a.x - b.x);
    return lines;
  }

  /**
   * The layout model often boxes each visual row of a two-column block as one
   * full-width region, which would keep unrelated columns glued together.
   * This pass finds column seams (second-in-line item starts that repeat at
   * the same x across many lines), splits splittable lines at the seams, and
   * reorders each consecutive run of column-bound lines column-by-column.
   */
  private readColumnwise(lines: OrderedLine[]): OrderedLine[] {
    const seams = this.detectColumnSeams(lines);
    if (seams.length === 0) return lines;

    const fragments = lines.flatMap((line) =>
      line.splittable ? this.splitAtSeams(line, seams) : [line]
    );

    const result: OrderedLine[] = [];
    let run: { line: OrderedLine; column: number }[] = [];
    const flush = (): void => {
      if (run.some((entry) => entry.column !== run[0]!.column)) {
        run.sort((a, b) => a.column - b.column || this.lineTop(a.line) - this.lineTop(b.line));
      }
      result.push(...run.map((entry) => entry.line));
      run = [];
    };
    for (const line of fragments) {
      const column = this.columnOf(line.items, seams);
      if (column === null) {
        flush();
        result.push(line);
      } else {
        run.push({ line, column });
      }
    }
    flush();
    return result;
  }

  private lineTop(line: OrderedLine): number {
    return Math.min(...line.items.map((item) => item.y));
  }

  /** Finds x positions where a same-line follow-up item starts on many lines. */
  private detectColumnSeams(lines: OrderedLine[]): number[] {
    const candidates: {
      x: number;
      gap: number;
      height: number;
      previousWidth: number;
      previousHeight: number;
    }[] = [];
    for (const line of lines) {
      if (!line.splittable) continue;
      for (let i = 1; i < line.items.length; i += 1) {
        const previous = line.items[i - 1]!;
        const item = line.items[i]!;
        candidates.push({
          x: item.x,
          gap: item.x - (previous.x + previous.width),
          height: item.height,
          previousWidth: previous.width,
          previousHeight: previous.height
        });
      }
    }
    const seams: number[] = [];
    seams.push(...this.detectRegionColumnSeams(lines));
    if (candidates.length < ReadingOrderBuilder.MIN_COLUMN_LINES) return this.uniqueSeams(seams);

    candidates.sort((a, b) => a.x - b.x);
    let cluster: typeof candidates = [];
    const closeCluster = (): void => {
      if (cluster.length < ReadingOrderBuilder.MIN_COLUMN_LINES) {
        cluster = [];
        return;
      }
      const medianGap = this.median(cluster.map((entry) => entry.gap));
      const medianHeight = this.median(cluster.map((entry) => entry.height));
      const medianPreviousWidth = this.median(cluster.map((entry) => entry.previousWidth));
      const medianPreviousHeight = this.median(cluster.map((entry) => entry.previousHeight));
      // Coincidental alignments inside flowing text have word-sized gaps;
      // a real column seam is preceded by clear whitespace on most lines and
      // by sentence-length text, not by list markers like "8.".
      const wideEnough =
        medianPreviousWidth >=
        medianPreviousHeight * ReadingOrderBuilder.MIN_COLUMN_TEXT_RATIO;
      if (medianGap >= medianHeight * 0.5 && wideEnough) {
        seams.push(this.median(cluster.map((entry) => entry.x)));
      }
      cluster = [];
    };
    for (const candidate of candidates) {
      const last = cluster[cluster.length - 1];
      if (last && candidate.x - last.x > ReadingOrderBuilder.COLUMN_TOLERANCE) closeCluster();
      cluster.push(candidate);
    }
    closeCluster();
    return this.uniqueSeams(seams);
  }

  private detectRegionColumnSeams(lines: OrderedLine[]): number[] {
    const starts = lines
      .filter((line) => line.splittable)
      .map((line) => ({
        x: Math.min(...line.items.map((item) => item.x)),
        width:
          Math.max(...line.items.map((item) => item.x + item.width)) -
          Math.min(...line.items.map((item) => item.x)),
        y: this.lineTop(line),
        height: Math.max(...line.items.map((item) => item.height))
      }))
      .sort((a, b) => a.x - b.x);
    if (starts.length < ReadingOrderBuilder.MIN_COLUMN_LINES * 2) return [];

    const clusters: typeof starts[] = [];
    for (const start of starts) {
      const cluster = clusters[clusters.length - 1];
      const last = cluster?.[cluster.length - 1];
      if (!cluster || !last || start.x - last.x > ReadingOrderBuilder.COLUMN_TOLERANCE) {
        clusters.push([start]);
      } else {
        cluster.push(start);
      }
    }
    if (clusters.length < 2) return [];

    const seams: number[] = [];
    const leftLines: typeof starts = [];
    for (const cluster of clusters) {
      if (leftLines.length > 0 && this.hasAlignedLeftRows(cluster, leftLines)) {
        seams.push(this.median(cluster.map((entry) => entry.x)));
      }
      leftLines.push(...cluster);
    }
    return seams;
  }

  private hasAlignedLeftRows(
    rightCluster: { x: number; y: number; width: number; height: number }[],
    leftLines: { x: number; y: number; width: number; height: number }[]
  ): boolean {
    let aligned = 0;
    for (const right of rightCluster) {
      const match = leftLines.find((left) => {
        const sameRow =
          Math.abs(left.y + left.height / 2 - (right.y + right.height / 2)) <=
          Math.max(left.height, right.height) * 0.75;
        const wideEnough =
          left.width >= left.height * ReadingOrderBuilder.MIN_COLUMN_TEXT_RATIO;
        return sameRow && wideEnough && left.x < right.x - ReadingOrderBuilder.COLUMN_TOLERANCE;
      });
      if (match) aligned += 1;
    }
    return aligned >= ReadingOrderBuilder.MIN_COLUMN_LINES;
  }

  private uniqueSeams(seams: number[]): number[] {
    const sorted = [...seams].sort((a, b) => a - b);
    const unique: number[] = [];
    for (const seam of sorted) {
      const previous = unique[unique.length - 1];
      if (previous === undefined || seam - previous > ReadingOrderBuilder.COLUMN_TOLERANCE) {
        unique.push(seam);
      }
    }
    return unique;
  }

  private splitAtSeams(line: OrderedLine, seams: number[]): OrderedLine[] {
    const fragments: OrderedLine[] = [];
    let current: PositionedOcrItem[] = [];
    for (const item of line.items) {
      const pieces = this.splitSpanningItem(item, seams);
      for (const piece of pieces) {
        const onSeam = seams.some(
          (seam) => Math.abs(piece.x - seam) <= ReadingOrderBuilder.COLUMN_TOLERANCE
        );
        if (onSeam && current.length > 0) {
          fragments.push({ items: current, splittable: line.splittable });
          current = [];
        }
        current.push(piece);
      }
    }
    if (current.length > 0) fragments.push({ items: current, splittable: line.splittable });
    return fragments;
  }

  private splitSpanningItem(item: PositionedOcrItem, seams: number[]): PositionedOcrItem[] {
    let pieces = [item];
    for (const seam of seams) {
      pieces = pieces.flatMap((piece) => this.splitItemAtSeam(piece, seam));
    }
    return pieces;
  }

  private splitItemAtSeam(item: PositionedOcrItem, seam: number): PositionedOcrItem[] {
    const right = item.x + item.width;
    if (
      seam <= item.x + ReadingOrderBuilder.COLUMN_TOLERANCE ||
      seam >= right - ReadingOrderBuilder.COLUMN_TOLERANCE
    ) {
      return [item];
    }

    const splitIndex = this.findColumnTextSplit(item.text, (seam - item.x) / item.width);
    if (splitIndex === null) return [item];

    const leftText = item.text.slice(0, splitIndex).trim();
    const rightText = item.text.slice(splitIndex).trim();
    if (!leftText || !rightText) return [item];

    return [
      { ...item, text: leftText, width: seam - item.x },
      { ...item, text: rightText, x: seam, width: right - seam }
    ];
  }

  private findColumnTextSplit(text: string, ratio: number): number | null {
    const target = Math.round(text.length * ratio);
    const spaces = [...text.matchAll(/\s+/g)]
      .map((match) => match.index ?? 0)
      .filter((index) => index > text.length * 0.2 && index < text.length * 0.85);
    if (spaces.length === 0) return null;

    const candidates = spaces.filter((index) => {
      const left = text.slice(0, index).trim();
      const right = text.slice(index).trim();
      return /(?:\. ?){2,}$|…$/.test(left) && /^[\p{L}\p{N}"']+/u.test(right);
    });
    if (candidates.length === 0) return null;

    const split = candidates.reduce((best, index) =>
      Math.abs(index - target) < Math.abs(best - target) ? index : best
    );
    if (Math.abs(split - target) > text.length * 0.15) return null;
    return split;
  }

  /** Column index for a line fully inside one column zone; null when it spans a seam. */
  private columnOf(items: PositionedOcrItem[], seams: number[]): number | null {
    const minX = Math.min(...items.map((item) => item.x));
    const maxX = Math.max(...items.map((item) => item.x + item.width));
    let column = 0;
    for (const seam of seams) {
      if (minX >= seam - ReadingOrderBuilder.COLUMN_TOLERANCE) {
        column += 1;
        continue;
      }
      if (maxX > seam + ReadingOrderBuilder.SPAN_TOLERANCE) return null;
    }
    return column;
  }

  private median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
  }
}
