import { useEffect } from "react";
import { X } from "lucide-react";
import { cx, ui } from "@/lib/uiClasses";
import { useBillingStore } from "@/store/billingStore";
import type { PaywallReason } from "@/services/apiBase";
import { PlanCards } from "@/components/billing/PlanCards";

const COPY: Record<PaywallReason, { title: string; body: string }> = {
  no_plan: {
    title: "Unlock your AI tutor",
    body: "Choose a plan to start chatting, uploading, and learning by voice."
  },
  insufficient_credits: {
    title: "You're out of credits",
    body: "Pick up where you left off — subscribe monthly or grab a one-time top-up."
  },
  daily_limit: {
    title: "Daily limit reached",
    body: "You've used today's allowance. It resets tomorrow, or add a one-time top-up to keep going now."
  }
};

/** Paywall shown whenever the backend blocks a billable action with a 402. */
export function PaywallModal() {
  const open = useBillingStore((s) => s.paywallOpen);
  const reason = useBillingStore((s) => s.paywallReason);
  const close = useBillingStore((s) => s.closePaywall);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) {
    return null;
  }

  const copy = COPY[reason];

  return (
    <div className={ui.modalBackdrop} onClick={close}>
      <div
        className={cx(ui.modalCard, "w-[min(640px,100%)]")}
        role="dialog"
        aria-modal="true"
        aria-labelledby="paywall-title"
        aria-describedby="paywall-body"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="paywall-title" className={ui.modalTitle}>
              {copy.title}
            </h3>
            <p id="paywall-body" className={ui.modalBody}>
              {copy.body}
            </p>
          </div>
          <button
            className={ui.iconButton}
            type="button"
            onClick={close}
            aria-label="Close"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <PlanCards />
      </div>
    </div>
  );
}
