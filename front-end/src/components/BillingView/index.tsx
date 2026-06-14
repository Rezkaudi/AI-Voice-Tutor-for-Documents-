import { useEffect, useState } from "react";
import { Repeat, Sparkles, X } from "lucide-react";
import { cx, ui } from "@/lib/uiClasses";
import { useBillingStore } from "@/store/billingStore";
import { PlanCards } from "@/components/billing/PlanCards";
import {
  cancelSubscription,
  resumeSubscription
} from "@/services/billingApi";
import { formatCredits } from "@/utils/formatCredits";

/** Account popup: per-bucket balances, plan cards, and subscription actions. */
export function BillingView() {
  const open = useBillingStore((s) => s.billingViewOpen);
  const close = useBillingStore((s) => s.closeBillingView);
  const balance = useBillingStore((s) => s.balance);
  const subscription = useBillingStore((s) => s.subscription);
  const refresh = useBillingStore((s) => s.refresh);
  const [busy, setBusy] = useState<"cancel" | "resume" | null>(null);

  useEffect(() => {
    if (!open) return;
    void refresh();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, refresh, close]);

  if (!open) {
    return null;
  }

  const run = async (kind: "cancel" | "resume", fn: () => Promise<void>) => {
    setBusy(kind);
    try {
      await fn();
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const active = subscription?.active === true;
  const cancelling = active && subscription?.cancelAtPeriodEnd === true;
  const hasTopup = (balance?.topupCredits ?? 0) > 0;
  const limit = subscription?.dailyCreditsLimit ?? 0;
  const remaining = subscription?.dailyCreditsRemaining ?? 0;
  const usedPct = limit > 0 ? Math.min(100, Math.max(0, (remaining / limit) * 100)) : 0;
  const periodEnd = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
    : null;

  return (
    <div className={ui.modalBackdrop} onClick={close}>
      <div
        className={cx(
          ui.modalCard,
          "max-h-[88vh] w-[min(560px,100%)] gap-4 overflow-y-auto"
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="billing-title"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 id="billing-title" className={ui.modalTitle}>
              Billing &amp; usage
            </h3>
            <p className="mt-0.5 text-[0.82rem] text-muted">
              Your credits and plan
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

        {/* Per-bucket balances — each tile shows only when that bucket applies:
            the subscription tile when a plan is active, the top-up tile when
            top-up credits exist. */}
        {active || hasTopup ? (
          <div
            className={cx("grid gap-3", active && hasTopup && "sm:grid-cols-2")}
          >
            {/* Subscription bucket */}
            {active ? (
              <div className={cx(ui.surface, "flex flex-col gap-2 p-4")}>
                <div className="flex items-center gap-1.5 text-[0.8rem] text-muted">
                  <Repeat size={14} aria-hidden />
                  Subscription
                </div>
                <div className="text-[1.9rem] font-bold leading-none text-ink tabular-nums">
                  {formatCredits(balance?.subscriptionCredits)}
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-paper">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
                <div className="text-[0.78rem] text-muted tabular-nums">
                  {formatCredits(remaining)} / {formatCredits(limit)} left today
                </div>
                <div className="text-[0.78rem] text-muted">
                  {cancelling
                    ? periodEnd
                      ? `Ends ${periodEnd}`
                      : "Ends at period end"
                    : periodEnd
                      ? `Renews ${periodEnd}`
                      : "Active"}
                </div>
              </div>
            ) : null}

            {/* Top-up bucket */}
            {hasTopup ? (
              <div className={cx(ui.surface, "flex flex-col gap-2 p-4")}>
                <div className="flex items-center gap-1.5 text-[0.8rem] text-muted">
                  <Sparkles size={14} aria-hidden />
                  Top-up credits
                </div>
                <div className="text-[1.9rem] font-bold leading-none text-ink tabular-nums">
                  {formatCredits(balance?.topupCredits)}
                </div>
                <div className="mt-auto text-[0.78rem] text-muted">
                  Never expires · no daily limit
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Purchase options. The Monthly card is a "Subscribe" when no plan is
            active, a "Resume" when one is cancelling, and hidden while a plan is
            active and renewing (so no duplicate subscription can be created). */}
        <PlanCards
          subscriptionMode={!active ? "subscribe" : cancelling ? "resume" : "hidden"}
          onResume={() => run("resume", resumeSubscription)}
        />

        {/* Cancel (only when an active, non-cancelling subscription exists) */}
        {active && !cancelling ? (
          <div className="flex justify-end">
            <button
              className="text-[0.82rem] text-muted underline-offset-2 transition-colors duration-150 hover:text-danger hover:underline"
              type="button"
              disabled={busy !== null}
              onClick={() => void run("cancel", cancelSubscription)}
            >
              {busy === "cancel" ? "Cancelling…" : "Cancel subscription"}
            </button>
          </div>
        ) : null}

        {/* Cancellation note (kept at the very bottom). */}
        {cancelling ? (
          <p className="m-0 text-center text-[0.82rem] text-muted">
            Your plan is set to cancel{periodEnd ? ` on ${periodEnd}` : ""} — resume
            above to keep it.
          </p>
        ) : null}
      </div>
    </div>
  );
}
