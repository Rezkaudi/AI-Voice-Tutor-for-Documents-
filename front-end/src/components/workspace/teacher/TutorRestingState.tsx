import { TriangleAlert, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "@/lib/uiClasses";
import {
  alertIcon,
  cardBase,
  cardOverlay,
  cardPanel,
  contactLink,
  message,
  status,
  statusDot
} from "@/styles/components/workspace/teacher/tutorRestingState";

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
      className={cx(cardBase, variant === "overlay" ? cardOverlay : cardPanel, className)}
    >
      <span className={status}>
        <span className={statusDot} />
        {t("teacher.unavailable.status")}
      </span>

      <div className="flex flex-col items-center gap-1.5">
        <TriangleAlert className={alertIcon} aria-hidden="true" />
        <p className={message}>{t("teacher.unavailable.message")}</p>
      </div>

      <a
        href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Tutor unavailable")}`}
        className={contactLink}
      >
        <Mail className="h-4 w-4" aria-hidden="true" />
        {t("teacher.unavailable.contact")}
      </a>
    </div>
  );
}
