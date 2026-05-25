import type { ReactNode } from "react";
import type { DocumentCitation } from "@/lib/types";
import { useDocumentStore } from "@/store/documentStore";

/**
 * Strip simple markdown bold/italic markers, parse `[[N]]` inline citation
 * markers into clickable badges, and split a message into paragraphs for
 * readable rendering in a chat bubble.
 */
export function renderMessageBody(
  content: string,
  citations: DocumentCitation[] = []
): ReactNode[] {
  const cleaned = content
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|\W)\*(.+?)\*(?=\W|$)/g, "$1$2")
    .replace(/(\[\[\d+\]\])(?:[\s,]*\[\[\d+\]\])+/g, "$1");

  return cleaned.split(/\n{2,}/).map((paragraph, paragraphIndex) => (
    <p key={paragraphIndex}>{renderWithCitations(paragraph, citations)}</p>
  ));
}

function renderWithCitations(
  paragraph: string,
  citations: DocumentCitation[]
): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /\[\[(\d+)\]\]/g;
  let lastIndex = 0;
  let badgeKey = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(paragraph)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(paragraph.slice(lastIndex, match.index));
    }
    const index = Number(match[1]) - 1;
    const citation = citations[index];
    if (citation) {
      nodes.push(
        <CitationBadge
          key={`c-${badgeKey++}`}
          number={index + 1}
          citation={citation}
        />
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < paragraph.length) {
    nodes.push(paragraph.slice(lastIndex));
  }
  return nodes;
}

interface CitationBadgeProps {
  number: number;
  citation: DocumentCitation;
}

function CitationBadge({ number, citation }: CitationBadgeProps) {
  const focusCitation = useDocumentStore((s) => s.focusCitation);
  return (
    <button
      type="button"
      onClick={() => focusCitation(citation)}
      aria-label={`Open reference ${number} on page ${citation.pageNumber}`}
      className="mx-0.5 inline-flex h-[1.45em] min-w-[1.7em] cursor-pointer items-center justify-center rounded-md border border-[oklch(0.78_0.18_80/0.6)] bg-[oklch(0.92_0.16_95)] px-1.5 align-[-0.15em] text-[0.72em] font-semibold leading-none tabular-nums text-[oklch(0.32_0.08_75)] transition-all duration-150 hover:-translate-y-px hover:border-[oklch(0.72_0.2_80)] hover:bg-[oklch(0.96_0.18_95)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {number}
    </button>
  );
}
