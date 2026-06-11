import { useEffect, useRef } from "react";
import type { DocumentCitation } from "@/lib/types";
import { citationKey } from "@/store/documentStore";


interface HighlightedArticleProps {
  text: string;
  /** Citations that target this page (already filtered by the parent). */
  citations: DocumentCitation[];
  focusCitationKey: string | null;
}


interface Segment {
  text: string;
  isMark: boolean;
}


/**
 * Plain prose page (text/markdown upload) with the *currently focused* citation
 * wrapped in a `<mark>`. Only one passage is highlighted at a time so the
 * highlight tracks the single sentence the teacher is speaking, rather than
 * lighting up every cited passage on the page at once.
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


  const focused = focusCitationKey
    ? citations.find((c) => citationKey(c) === focusCitationKey) ?? null
    : null;
  const segments = buildSegments(text, focused);


  return (
    <article className="mx-auto min-h-[min(980px,calc(100dvh-190px))] w-[min(100%,840px)] whitespace-pre-wrap rounded border border-[oklch(0.86_0.016_86)] bg-[oklch(0.994_0.006_92)] p-[clamp(22px,4vw,46px)] text-[clamp(0.95rem,1.3vw,1.05rem)] leading-[1.72] shadow-[0_16px_28px_oklch(0.25_0.018_245/0.1)]">
      {segments.map((segment, index) => {
        if (!segment.isMark) return <span key={index}>{segment.text}</span>;
        return (
          <mark
            key={index}
            ref={(el) => { focusRef.current = el; }}
            className="rounded-[3px] px-0.5 transition-colors duration-200"
            style={{
              background: "oklch(0.88 0.16 95 / 0.65)",
              color: "inherit",
              boxShadow: "0 0 0 1px oklch(0.78 0.18 80 / 0.55)"
            }}
          >
            {segment.text}
          </mark>
        );
      })}
    </article>
  );
}


/** Splits the page into [before, mark, after] runs around the focused citation. */
function buildSegments(text: string, citation: DocumentCitation | null): Segment[] {
  if (!citation) return [{ text, isMark: false }];


  const start = Math.max(0, Math.min(citation.start, text.length));
  const end = Math.max(start, Math.min(citation.end, text.length));
  if (end <= start) return [{ text, isMark: false }];


  const segments: Segment[] = [];
  if (start > 0) segments.push({ text: text.slice(0, start), isMark: false });
  segments.push({ text: text.slice(start, end), isMark: true });
  if (end < text.length) segments.push({ text: text.slice(end), isMark: false });
  return segments;
}
