import { Check, FileText, Loader2, Trash2 } from "lucide-react";
import { cx, ui } from "@/lib/uiClasses";
import type { DocumentSummary } from "@/lib/types";
import { formatMeta } from "./formatMeta";

interface DocumentRowProps {
  doc: DocumentSummary;
  isActive: boolean;
  isDeleting: boolean;
  onSelect: (id: string) => void;
  onRequestDelete?: (id: string) => void;
}

/** Single row in the library list: select-to-open, optional delete. */
export function DocumentRow({
  doc,
  isActive,
  isDeleting,
  onSelect,
  onRequestDelete
}: DocumentRowProps) {
  const label = doc.title || doc.fileName || "Untitled document";

  return (
    <li>
      <div
        className={cx(
          "group relative flex w-full items-stretch gap-1 rounded-lg border border-line bg-paper-strong transition-[background,border-color] duration-140 ease-out",
          "hover:border-accent",
          isActive && "border-accent bg-[oklch(0.96_0.04_154)]",
          isDeleting && "opacity-60"
        )}
      >
        <button
          type="button"
          role="option"
          aria-selected={isActive}
          disabled={isDeleting}
          onClick={() => onSelect(doc.id)}
          className={cx(
            "flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-l-lg px-3 py-2.5 text-left",
            ui.focusAccent,
            "disabled:cursor-not-allowed"
          )}
        >
          <span
            className={cx(
              "grid h-9 w-9 flex-none place-items-center rounded-md border border-line bg-panel text-muted",
              isActive && "border-accent bg-accent text-paper-strong"
            )}
            aria-hidden
          >
            <FileText size={18} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[0.95rem] font-[650] leading-tight text-ink">
              {label}
            </span>
            <span className="mt-0.5 truncate text-[0.78rem] text-muted">
              {formatMeta(doc)}
            </span>
          </span>
          {isActive ? (
            <Check size={18} className="flex-none text-accent" aria-label="Currently open" />
          ) : null}
        </button>

        {onRequestDelete ? (
          <button
            type="button"
            title="Delete document"
            aria-label={`Delete ${label}`}
            disabled={isDeleting}
            onClick={() => onRequestDelete(doc.id)}
            className={cx(
              "my-1.5 mr-1.5 grid h-8 w-8 flex-none place-items-center self-center rounded-md text-muted transition-colors hover:bg-[oklch(0.96_0.04_28)] hover:text-danger",
              ui.focusAccent,
              "disabled:cursor-not-allowed"
            )}
          >
            {isDeleting ? (
              <Loader2 className={ui.spin} size={16} aria-hidden />
            ) : (
              <Trash2 size={16} aria-hidden />
            )}
          </button>
        ) : null}
      </div>
    </li>
  );
}
