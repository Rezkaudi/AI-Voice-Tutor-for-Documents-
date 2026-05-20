import type { SegmentedText } from "@/lib/types";

/**
 * Text segmentation for the live caption: splitting a sentence into display
 * words and detecting right-to-left scripts.
 */

// Strong right-to-left scripts: Hebrew (+ presentation forms), Arabic
// (+ supplement / extended / presentation forms), Syriac, Thaana, NKo.
// Their presence flips the caption to RTL.
const RTL_PATTERN =
  /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u0780-\u07BF\u07C0-\u07FF\u0860-\u08FF\uFB1D-\uFB4F\uFB50-\uFDFF\uFE70-\uFEFF]/;

/** True when the text is written in a right-to-left script. */
export function isRtlText(text: string): boolean {
  return RTL_PATTERN.test(text);
}

/**
 * Splits a sentence into caption words. Whitespace languages split on spaces;
 * languages written without spaces (Japanese, Chinese, …) are segmented with
 * `Intl.Segmenter` so the caption reveals and scrolls token-by-token instead
 * of as one unbreakable blob that overflows the strip.
 *
 * @param {string} text
 * @returns {SegmentedText}
 */
export function segmentText(text: string): SegmentedText {
  const trimmed = text.trim();
  if (!trimmed) {
    return { words: [], offsets: [], spaced: true, rtl: false };
  }

  const rtl = isRtlText(trimmed);

  if (/\s/.test(trimmed)) {
    const words: string[] = [];
    const offsets: number[] = [];
    for (const match of trimmed.matchAll(/\S+/g)) {
      words.push(match[0]);
      offsets.push(match.index ?? 0);
    }
    return { words, offsets, spaced: true, rtl };
  }

  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    try {
      const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
      const words: string[] = [];
      const offsets: number[] = [];
      for (const part of segmenter.segment(trimmed)) {
        if (part.segment.trim()) {
          words.push(part.segment);
          offsets.push(part.index);
        }
      }
      if (words.length > 0) {
        return { words, offsets, spaced: false, rtl };
      }
    } catch {
      // Older browsers without Intl.Segmenter — fall through to the whole line.
    }
  }

  return { words: [trimmed], offsets: [0], spaced: false, rtl };
}
