import { TriangleAlert, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "@/lib/uiClasses";

const SUPPORT_EMAIL = "info@nipporia.com";

interface TutorRestingStateProps {
  /** "overlay" = mobile CallOverlay, "panel" = desktop TeacherPanel */
  variant?: "overlay" | "panel";
  className?: string;
}

/**
 * Calm, brand-safe stand-in for a raw backend/provider error on the teacher side.
 * Never renders the underlying error text — the user only learns the tutor is
 * momentarily resting, plus a way to reach support. No vendor name, no "quota".
 */
export function TutorRestingState({ variant = "panel", className }: TutorRestingStateProps) {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      aria-live="polite"
      className={cx(
        "flex flex-col items-center gap-3 rounded-2xl border px-5 py-4 text-center",
        "border-[oklch(0.42_0.04_235)] bg-[oklch(0.26_0.03_235/0.92)] shadow-[0_10px_28px_oklch(0.1_0.03_235/0.45)] backdrop-blur-[8px]",
        variant === "overlay" ? "pointer-events-auto max-w-[min(560px,92vw)]" : "w-full max-w-[420px]",
        className
      )}
    >
      <span className="inline-flex items-center gap-2 text-[0.85rem] font-semibold text-[oklch(0.88_0.02_235)]">
        <span className="h-2 w-2 rounded-full bg-[oklch(0.78_0.14_75)] motion-safe:animate-pulse" />
        {t("teacher.unavailable.status")}
      </span>

      <div className="flex flex-col items-center gap-1.5">
        <TriangleAlert className="h-6 w-6 text-[oklch(0.78_0.14_75)]" aria-hidden="true" />
        <p className="m-0 text-[0.92rem] leading-relaxed text-[oklch(0.9_0.02_235)]">
          {t("teacher.unavailable.message")}
        </p>
      </div>

      <a
        href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Tutor unavailable")}`}
        className={cx(
          "mt-0.5 inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-4",
          "border border-[oklch(0.42_0.04_235)] bg-[oklch(0.3_0.03_235/0.9)] text-[0.85rem] font-semibold text-[oklch(0.9_0.05_230)]",
          "transition-colors duration-200 hover:bg-[oklch(0.36_0.04_235/0.95)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.74_0.12_230)]"
        )}
      >
        <Mail className="h-4 w-4" aria-hidden="true" />
        {t("teacher.unavailable.contact")}
      </a>
    </div>
  );
}
