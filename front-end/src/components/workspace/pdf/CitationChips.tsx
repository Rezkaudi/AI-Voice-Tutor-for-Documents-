import type { DocumentCitation } from "@/types";

interface CitationChipsProps {
  citations: DocumentCitation[];
  activeKey: string | null;
  onPick: (citation: DocumentCitation) => void;
}

export function CitationChips({ citations, activeKey, onPick }: CitationChipsProps) {
  if (!citations.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {citations.map((citation, index) => {
        const key = `${citation.pageNumber}:${citation.start}:${citation.end}`;
        const isActive = key === activeKey;
        return (
          <button
            type="button"
            key={key}
            onClick={() => onPick(citation)}
            aria-pressed={isActive}
            aria-label={`Citation ${index + 1} on page ${citation.pageNumber}`}
            className={
              "inline-flex h-7 min-w-[2.75rem] items-center justify-center rounded-full border px-2.5 text-[0.78rem] font-semibold tabular-nums leading-none transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
              (isActive
                ? "border-[oklch(0.78_0.18_80)] bg-[oklch(0.92_0.16_95)] text-[oklch(0.32_0.08_75)] shadow-[0_1px_2px_oklch(0.5_0.15_75/0.25)]"
                : "border-line bg-paper-strong text-muted hover:-translate-y-px hover:border-[oklch(0.78_0.18_80/0.5)] hover:bg-[oklch(0.97_0.05_95)] hover:text-[oklch(0.35_0.06_75)]")
            }
          >
            p.{citation.pageNumber}
          </button>
        );
      })}
    </div>
  );
}
