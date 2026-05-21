import { Loader2 } from "lucide-react";
import { ui } from "@/lib/uiClasses";

export function LoadingState() {
  return (
    <div
      className="grid place-items-center gap-2 px-2 py-8 text-muted"
      role="status"
      aria-live="polite"
    >
      <Loader2 className={ui.spin} size={22} aria-hidden />
      <span className="text-[0.86rem]">Loading your library…</span>
    </div>
  );
}

export function EmptyState({ hint }: { hint?: string }) {
  return (
    <p className="m-0 rounded-lg border border-dashed border-line bg-paper-strong/60 px-3 py-4 text-center text-[0.86rem] text-muted">
      {hint ?? "No documents yet — upload your first to get started."}
    </p>
  );
}
