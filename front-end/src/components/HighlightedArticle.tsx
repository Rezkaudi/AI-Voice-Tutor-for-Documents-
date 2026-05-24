import { useEffect, useRef } from "react";
import type { DocumentCitation } from "@/lib/types";

interface HighlightedArticleProps {
  text: string;
  /** Citations that target this page (already filtered by the parent). */
  citations: DocumentCitation[];
  focusCitationKey: string | null;
}

interface Segment {
  text: string;
  citationKey: string | null;
  isFocus: boolean;
}

/**
 * Plain prose page (text/markdown upload) with citation spans wrapped in
 * `<mark>`. Sorts citations and clips overlaps so each character paints once.
 */
export function HighlightedArticle({
  text,
  citations,
  focusCitationKey
}: HighlightedArticleProps) {
  const focusRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (focusCitationKey && focusRef.current) {
      focusRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [focusCitationKey]);

  const segments = buildSegments(text, citations);

  return (
    <article className="mx-auto min-h-[min(980px,calc(100dvh-190px))] w-[min(100%,840px)] whitespace-pre-wrap rounded border border-[oklch(0.86_0.016_86)] bg-[oklch(0.994_0.006_92)] p-[clamp(22px,4vw,46px)] text-[clamp(0.95rem,1.3vw,1.05rem)] leading-[1.72] shadow-[0_16px_28px_oklch(0.25_0.018_245/0.1)]">
      {segments.map((segment, index) => {
        if (!segment.citationKey) return <span key={index}>{segment.text}</span>;
        return (
          <mark
            key={index}
            ref={segment.isFocus && segment.citationKey === focusCitationKey
              ? (el) => { focusRef.current = el; }
              : undefined}
            className="rounded-[3px] px-0.5 transition-colors duration-200"
            style={{
              background: segment.isFocus
                ? "oklch(0.88 0.16 95 / 0.65)"
                : "oklch(0.94 0.14 95 / 0.55)",
              color: "inherit",
              boxShadow: segment.isFocus
                ? "0 0 0 1px oklch(0.78 0.18 80 / 0.55)"
                : undefined
            }}
          >
            {segment.text}
          </mark>
        );
      })}
    </article>
  );
}

/** Sorts citations by `start`, clips overlaps, and chops the page into runs. */
function buildSegments(text: string, citations: DocumentCitation[]): Segment[] {
  if (!citations.length) return [{ text, citationKey: null, isFocus: false }];

  const sorted = [...citations].sort((a, b) => a.start - b.start);
  const segments: Segment[] = [];
  let cursor = 0;
  for (const citation of sorted) {
    const start = Math.max(cursor, Math.min(citation.start, text.length));
    const end = Math.max(start, Math.min(citation.end, text.length));
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), citationKey: null, isFocus: false });
    }
    if (end > start) {
      const key = `${citation.pageNumber}:${citation.start}:${citation.end}`;
      segments.push({
        text: text.slice(start, end),
        citationKey: key,
        isFocus: true // focus state is resolved at render time
      });
      cursor = end;
    }
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), citationKey: null, isFocus: false });
  }
  return segments;
}
