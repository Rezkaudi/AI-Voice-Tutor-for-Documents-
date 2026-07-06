import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PdfLoadProgress } from "@/hooks/pdf-viewer/usePdfDocument";

interface DocumentLoadingOverlayProps {
  label?: string;
  hint?: string;
  progress?: PdfLoadProgress | null;
}

const MB = 1024 * 1024;

function formatMb(bytes: number): string {
  const mb = bytes / MB;
  return mb >= 10 ? mb.toFixed(0) : mb.toFixed(1);
}

export function DocumentLoadingOverlay({
  label,
  hint,
  progress
}: DocumentLoadingOverlayProps) {
  const { t } = useTranslation();

  const determinate = !!progress && progress.ratio !== null;
  const pct = determinate ? Math.round((progress?.ratio ?? 0) * 100) : 0;
  const showBytes = determinate && (progress?.total ?? 0) > 0;

  const resolvedLabel = label ?? t("workspace.loadingDocument");
  const resolvedHint =
    hint ?? (determinate ? t("workspace.loadingDownloading") : t("workspace.loadingHint"));

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="absolute inset-0 z-50 grid place-items-center rounded-md bg-[oklch(0.985_0.009_86/0.92)] backdrop-blur-[6px] [-webkit-backdrop-filter:blur(6px)] animate-modal-fade"
    >
      <div className="flex w-[min(20rem,calc(100vw-2.5rem))] flex-col items-center gap-4 rounded-2xl border border-line bg-paper-strong px-6 py-6 shadow-app animate-modal-pop">
        <div className="relative grid h-14 w-14 place-items-center">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full border-2 border-[oklch(0.86_0.02_86)]"
          />
          <span
            aria-hidden
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent border-r-accent animate-spin-fast"
          />
          <FileText className="text-accent-ink" size={22} aria-hidden />
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          <p className="m-0 text-[0.95rem] font-[680] text-ink">{resolvedLabel}</p>
          <p className="m-0 text-[0.82rem] text-muted">{resolvedHint}</p>
        </div>

        {/* Progress meter: determinate fill, or an indeterminate sweep. */}
        <div className="flex w-full flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <div
              role="progressbar"
              aria-label={resolvedLabel}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={determinate ? pct : undefined}
              aria-valuetext={determinate ? `${pct}%` : undefined}
              className="relative h-2 flex-1 overflow-hidden rounded-full bg-[oklch(0.9_0.016_86)]"
            >
              {determinate ? (
                <div
                  className="absolute inset-y-0 start-0 overflow-hidden rounded-full bg-[linear-gradient(90deg,var(--color-accent),oklch(0.64_0.12_154))] transition-[width] duration-300 ease-out will-change-[width]"
                  style={{ width: `${pct}%` }}
                >
                  <span
                    aria-hidden
                    className="absolute inset-y-0 w-1/3 bg-[linear-gradient(90deg,transparent,oklch(1_0_0/0.55),transparent)] animate-progress-sheen"
                  />
                </div>
              ) : (
                <div
                  aria-hidden
                  className="absolute inset-y-0 start-0 w-full origin-left rounded-full bg-[linear-gradient(90deg,var(--color-accent),oklch(0.64_0.12_154))] animate-progress-indeterminate will-change-transform"
                />
              )}
            </div>
            {determinate ? (
              <span className="min-w-[2.75ch] text-end text-[0.8rem] font-[650] tabular-nums text-accent-ink">
                {pct}%
              </span>
            ) : null}
          </div>
          {showBytes ? (
            <p className="m-0 text-[0.72rem] tabular-nums text-muted">
              {formatMb(progress?.loaded ?? 0)} / {formatMb(progress?.total ?? 0)} MB
            </p>
          ) : null}
        </div>

        <span className="sr-only">
          {determinate ? `${resolvedLabel} ${pct}%` : resolvedLabel}
        </span>
      </div>
    </div>
  );
}
