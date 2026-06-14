import { Zap } from "lucide-react";
import type { AuthUser } from "@/services/authApi";
import { cx, ui } from "@/lib/uiClasses";
import { useBillingStore } from "@/store/billingStore";
import { UserAvatar } from "./UserAvatar";

export function UserMenu({ user }: { user: AuthUser }) {
  const openBillingView = useBillingStore((s) => s.openBillingView);

  return (
    <div className="flex items-center gap-2">
      {/* Plans button — opens the billing popup (no credit count in the header). */}
      <button
        type="button"
        className={cx(ui.button, "min-h-0 px-[11px] py-[7px] text-[0.8rem]")}
        onClick={openBillingView}
        aria-label="Billing and plans"
      >
        <Zap size={15} className="text-accent" aria-hidden />
        Plans
      </button>

      {/* Avatar also opens the popup. */}
      <button
        type="button"
        className="flex-none rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        onClick={openBillingView}
        aria-label="Account"
      >
        <UserAvatar name={user.name} picture={user.picture} size={36} />
      </button>
    </div>
  );
}
