import type { SegmentedText } from "@/types";

/**
 * Text segmentation for the live caption: stripping the tutor's inline
 * markdown into per-word style flags, splitting a sentence into display
 * words, and detecting right-to-left scripts.
 */

// Per-word style bitmask values carried on `SegmentedText.styles` and
// `SpeechCaption.styles`. OR-combined when a word carries several.
export const WORD_BOLD = 1;
export const WORD_ITALIC = 2;
export const WORD_CODE = 4;
export const WORD_QUOTED = 8;

// Strong right-to-left scripts: Hebrew (+ presentation forms), Arabic
// (+ supplement / extended / presentation forms), Syriac, Thaana, NKo.
// Their presence flips the caption to RTL.
const RTL_PATTERN =
  /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u0780-\u07BF\u07C0-\u07FF\u0860-\u08FF\uFB1D-\uFB4F\uFB50-\uFDFF\uFE70-\uFEFF]/;

/** True when the text is written in a right-to-left script. */
export function isRtlText(text: string): boolean {
  return RTL_PATTERN.test(text);
}

// Opening quote → its closing counterpart. Single quotes/apostrophes are
// skipped on purpose — too ambiguous with contractions like "it's".
const QUOTE_PAIRS: Record<string, string> = {
  '"': '"',
  "“": "”", // “ ”
  "«": "»", // « »
  "「": "」" // 「 」
};

interface ParsedInline {
  /** Sentence with markdown markers removed — safe to hand to TTS. */
  clean: string;
  /** Style bitmask per character of `clean`. */
  flags: number[];
}

/**
 * Strips the tutor's inline markdown (`**bold**`, `*italic*`, `` `code` ``,
 * leading `#`/`-`/`>` line markers) and tags quoted spans, recording a style
 * bitmask per surviving character. A marker only activates when its closing
 * counterpart exists later in the sentence; an unpaired single `*` or
 * backtick stays literal so it never swallows words, while an unpaired `**`
 * is dropped outright — it's always a split artifact, never prose.
 */
function parseInlineStyles(text: string): ParsedInline {
  let src = text;
  let baseFlags = 0;

  // The sentence splitter breaks on newlines, so each markdown line arrives
  // as its own caption sentence with its block marker still at the front.
  const heading = /^#{1,6}\s+/.exec(src);
  const blockquote = heading ? null : /^>\s+/.exec(src);
  const bullet = heading || blockquote ? null : /^[-*•]\s+/.exec(src);
  if (heading) {
    src = src.slice(heading[0].length);
    baseFlags |= WORD_BOLD;
  } else if (blockquote) {
    src = src.slice(blockquote[0].length);
    baseFlags |= WORD_QUOTED;
  } else if (bullet) {
    src = src.slice(bullet[0].length);
  }

  const cleanChars: string[] = [];
  const flags: number[] = [];
  let bold = false;
  let italic = false;
  let quoted = false;
  let closingQuote: string | null = null;

  const push = (ch: string, extra = 0): void => {
    cleanChars.push(ch);
    flags.push(
      baseFlags |
        extra |
        (bold ? WORD_BOLD : 0) |
        (italic ? WORD_ITALIC : 0) |
        (quoted ? WORD_QUOTED : 0)
    );
  };

  for (let i = 0; i < src.length; ) {
    const ch = src[i]!;

    // Code spans are literal inside, so consume the whole span at once.
    if (ch === "`") {
      const close = src.indexOf("`", i + 1);
      if (close > i + 1) {
        for (let j = i + 1; j < close; j += 1) push(src[j]!, WORD_CODE);
        i = close + 1;
        continue;
      }
    }

    if (ch === "*" && src[i + 1] === "*") {
      if (bold || src.indexOf("**", i + 2) !== -1) {
        bold = !bold;
      }
      // An unpaired `**` is an artifact (a bold span cut in half upstream),
      // never prose — drop it rather than caption raw asterisks.
      i += 2;
      continue;
    } else if (ch === "*") {
      if (italic) {
        italic = false;
        i += 1;
        continue;
      }
      if (canOpenItalic(src, i)) {
        italic = true;
        i += 1;
        continue;
      }
    }

    if (closingQuote !== null) {
      if (ch === closingQuote) {
        // Push before clearing state so the closing mark stays tinted.
        push(ch);
        quoted = false;
        closingQuote = null;
        i += 1;
        continue;
      }
    } else {
      const closer = QUOTE_PAIRS[ch];
      if (closer !== undefined && src.indexOf(closer, i + 1) !== -1) {
        quoted = true;
        closingQuote = closer;
        push(ch);
        i += 1;
        continue;
      }
    }

    push(ch);
    i += 1;
  }

  // Stripping edge markers can leave whitespace at either end; trim the text
  // and flags together so offsets keep lining up character-for-character.
  let start = 0;
  let end = cleanChars.length;
  while (start < end && /\s/.test(cleanChars[start]!)) start += 1;
  while (end > start && /\s/.test(cleanChars[end - 1]!)) end -= 1;

  return {
    clean: cleanChars.slice(start, end).join(""),
    flags: flags.slice(start, end)
  };
}

/**
 * A lone `*` opens emphasis only at a word boundary, before a non-space
 * character, with another `*` ahead to close it — so "2 * 3" and "3*4"
 * stay literal.
 */
function canOpenItalic(src: string, i: number): boolean {
  const next = src[i + 1];
  if (next === undefined || next === "*" || /\s/.test(next)) return false;
  const prev = i > 0 ? src[i - 1]! : "";
  if (prev !== "" && /[\p{L}\p{N}]/u.test(prev)) return false;
  return src.indexOf("*", i + 1) !== -1;
}

/**
 * Splits a sentence into caption words after stripping inline markdown, and
 * tags each word with the style flags of the span it came from. Whitespace
 * languages split on spaces; languages written without spaces (Japanese,
 * Chinese, …) are segmented with `Intl.Segmenter` so the caption reveals and
 * scrolls token-by-token instead of as one unbreakable blob that overflows
 * the strip.
 *
 * `clean` is the stripped sentence the words/offsets index into — the same
 * string callers should hand to TTS so caption sync stays exact.
 *
 * @param {string} text
 * @returns {SegmentedText}
 */
export function segmentText(text: string): SegmentedText {
  const { clean, flags } = parseInlineStyles(text.trim());
  if (!clean) {
    return { words: [], offsets: [], styles: [], clean: "", spaced: true, rtl: false };
  }

  const rtl = isRtlText(clean);
  const styleAt = (from: number, to: number): number => {
    let style = 0;
    for (let i = from; i < to; i += 1) style |= flags[i] ?? 0;
    return style;
  };

  if (/\s/.test(clean)) {
    const words: string[] = [];
    const offsets: number[] = [];
    const styles: number[] = [];
    for (const match of clean.matchAll(/\S+/g)) {
      const offset = match.index ?? 0;
      words.push(match[0]);
      offsets.push(offset);
      styles.push(styleAt(offset, offset + match[0].length));
    }
    return { words, offsets, styles, clean, spaced: true, rtl };
  }

  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    try {
      const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
      const words: string[] = [];
      const offsets: number[] = [];
      const styles: number[] = [];
      for (const part of segmenter.segment(clean)) {
        if (part.segment.trim()) {
          words.push(part.segment);
          offsets.push(part.index);
          styles.push(styleAt(part.index, part.index + part.segment.length));
        }
      }
      if (words.length > 0) {
        return { words, offsets, styles, clean, spaced: false, rtl };
      }
    } catch {
      // Older browsers without Intl.Segmenter — fall through to the whole line.
    }
  }

  return {
    words: [clean],
    offsets: [0],
    styles: [styleAt(0, clean.length)],
    clean,
    spaced: false,
    rtl
  };
}
