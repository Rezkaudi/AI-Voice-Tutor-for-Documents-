import { Loader2 } from "lucide-react";

/** Centered full-viewport spinner used while auth or a document resolves. */
export function FullScreenLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-paper text-muted">
      <Loader2 className="animate-spin-fast" size={28} aria-label={label} />
    </div>
  );
}
