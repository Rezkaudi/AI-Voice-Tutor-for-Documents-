/** A layout region detected on a rendered page image, in model reading order. */
export interface LayoutRegion {
  label: string;
  score: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** One OCR item positioned on the page (top-left corner + size, image pixels). */
export interface PositionedOcrItem {
  text: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
