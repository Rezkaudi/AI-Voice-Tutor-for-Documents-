import { useState } from "react";
import { CreditCard, Repeat } from "lucide-react";
import { cx, ui } from "@/lib/uiClasses";
import { startSubscriptionCheckout, startTopupCheckout } from "@/services/billingApi";
import { PlanCard } from "./PlanCard";

export type SubscriptionMode = "subscribe" | "resume" | "hidden";

interface PlanCardsProps {
  subscriptionMode?: SubscriptionMode;
  onResume?: () => Promise<void>;
}

export function PlanCards({ subscriptionMode = "subscribe", onResume }: PlanCardsProps) {
  const [busy, setBusy] = useState<"sub" | "topup" | "resume" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: "sub" | "topup" | "resume") => {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "sub") await startSubscriptionCheckout();
      else if (kind === "topup") await startTopupCheckout();
      else await onResume?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  const resuming = subscriptionMode === "resume";

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {subscriptionMode !== "hidden" ? (
          <PlanCard
            featured
            icon={<Repeat size={18} aria-hidden />}
            name="Monthly"
            price="$5"
            cadence="/month"
            features={[
              "500 credits every month",
              "Resets each renewal",
              "~16 credits per day",
              "Best for daily learners"
            ]}
            cta={
              resuming
                ? busy === "resume"
                  ? "Resuming…"
                  : "Resume"
                : busy === "sub"
                  ? "Starting…"
                  : "Subscribe"
            }
            disabled={busy !== null}
            onClick={() => run(resuming ? "resume" : "sub")}
          />
        ) : null}
        <PlanCard
          icon={<CreditCard size={18} aria-hidden />}
          name="One-time top-up"
          price="$5"
          cadence="once"
          features={[
            "500 credits added instantly",
            "Credits stack on your balance",
            "No daily limit",
            "Pay again whenever you run out"
          ]}
          cta={busy === "topup" ? "Starting…" : "Buy credits"}
          disabled={busy !== null}
          onClick={() => run("topup")}
        />
      </div>
      {error ? <p className={cx(ui.errorText, "mt-2")}>{error}</p> : null}
    </div>
  );
}
