import type { SegmentedText } from "@/types";

export const WORD_BOLD = 1;
export const WORD_ITALIC = 2;
export const WORD_CODE = 4;
export const WORD_QUOTED = 8;

const RTL_PATTERN =
  /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u0780-\u07BF\u07C0-\u07FF\u0860-\u08FF\uFB1D-\uFB4F\uFB50-\uFDFF\uFE70-\uFEFF]/;

export function isRtlText(text: string): boolean {
  return RTL_PATTERN.test(text);
}

const QUOTE_PAIRS: Record<string, string> = {
  '"': '"',
  "“": "”",
  "«": "»",
  "「": "」"
};

interface ParsedInline {

  clean: string;

  flags: number[];
}

function parseInlineStyles(text: string): ParsedInline {
  let src = text;
  let baseFlags = 0;

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

  let start = 0;
  let end = cleanChars.length;
  while (start < end && /\s/.test(cleanChars[start]!)) start += 1;
  while (end > start && /\s/.test(cleanChars[end - 1]!)) end -= 1;

  return {
    clean: cleanChars.slice(start, end).join(""),
    flags: flags.slice(start, end)
  };
}

function canOpenItalic(src: string, i: number): boolean {
  const next = src[i + 1];
  if (next === undefined || next === "*" || /\s/.test(next)) return false;
  const prev = i > 0 ? src[i - 1]! : "";
  if (prev !== "" && /[\p{L}\p{N}]/u.test(prev)) return false;
  return src.indexOf("*", i + 1) !== -1;
}

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
