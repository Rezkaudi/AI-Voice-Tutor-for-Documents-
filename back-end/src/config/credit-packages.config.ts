import { ENV_CONFIG } from "@/config/env.config";

export interface CreditPackage {
  readonly id: string;
  readonly priceId: string;
  readonly name: string;
  readonly credits: number;
  readonly amount: number;
  readonly currency: string;
}

const ONETIME_CREDITS = ENV_CONFIG.ONETIME_PRICE_USD * ENV_CONFIG.CREDITS_PER_DOLLAR;

export const CREDIT_PACKAGES: Readonly<Record<string, CreditPackage>> =
  Object.freeze({
    topup: {
      id: "topup",
      priceId: ENV_CONFIG.STRIPE_PRICE_ONETIME,
      name: `${ONETIME_CREDITS} credits`,
      credits: ONETIME_CREDITS,
      amount: ENV_CONFIG.ONETIME_PRICE_USD,
      currency: "usd"
    }
  });

export const getCreditPackage = (id: string): CreditPackage | undefined => CREDIT_PACKAGES[id];
