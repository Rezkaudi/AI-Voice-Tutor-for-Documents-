import { create } from "zustand";
import { setPaywallHandler, type PaywallReason } from "@/services/apiBase";
import {
  getBalance,
  getSubscriptionStatus,
  type Balance,
  type SubscriptionStatus
} from "@/services/billingApi";

interface BillingStore {
  balance: Balance | null;
  subscription: SubscriptionStatus | null;
  paywallOpen: boolean;
  paywallReason: PaywallReason;
  billingViewOpen: boolean;
  loading: boolean;

  openPaywall: (reason: PaywallReason) => void;
  closePaywall: () => void;
  openBillingView: () => void;
  closeBillingView: () => void;
  refresh: () => Promise<void>;
}

export const useBillingStore = create<BillingStore>((set) => {
  setPaywallHandler((reason) =>
    set({ paywallOpen: true, paywallReason: reason })
  );

  return {
    balance: null,
    subscription: null,
    paywallOpen: false,
    paywallReason: "insufficient_credits",
    billingViewOpen: false,
    loading: false,

    openPaywall: (reason) => set({ paywallOpen: true, paywallReason: reason }),
    closePaywall: () => set({ paywallOpen: false }),
    openBillingView: () => {
      set({ billingViewOpen: true });
      void useBillingStore.getState().refresh();
    },
    closeBillingView: () => set({ billingViewOpen: false }),

    refresh: async () => {
      set({ loading: true });
      try {
        const [balance, subscription] = await Promise.all([
          getBalance(),
          getSubscriptionStatus()
        ]);
        set({ balance, subscription });
      } catch {
        // Non-fatal — the view simply shows what it last had.
      } finally {
        set({ loading: false });
      }
    }
  };
});
