import { Loader2 } from "lucide-react";
import { ui } from "@/lib/uiClasses";

interface DocumentLoadingOverlayProps {
  label?: string;
  hint?: string;
}

export function DocumentLoadingOverlay({
  label = "Loading document",
  hint = "Fetching pages and preparing the board…"
}: DocumentLoadingOverlayProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="absolute inset-0 z-20 grid place-items-center rounded-md bg-[oklch(0.985_0.009_86/0.72)] backdrop-blur-[6px] [-webkit-backdrop-filter:blur(6px)] animate-modal-fade"
    >
      <div className="flex flex-col items-center gap-3.5 rounded-2xl border border-line bg-paper-strong px-6 py-5 shadow-app animate-modal-pop">
        <div className="relative grid h-14 w-14 place-items-center">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full border-2 border-[oklch(0.86_0.02_86)]"
          />
          <span
            aria-hidden
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent border-r-accent animate-spin-fast"
          />
          <Loader2 className={ui.spin} size={22} aria-hidden />
        </div>
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="m-0 text-[0.95rem] font-[680] text-ink">{label}</p>
          <p className="m-0 text-[0.82rem] text-muted">{hint}</p>
        </div>
        <span className="sr-only">{label}</span>
      </div>
    </div>
  );
}
