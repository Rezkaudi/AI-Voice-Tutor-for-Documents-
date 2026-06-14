import { ENV_CONFIG } from "@/config/env.config";

export interface SubscriptionPlan {
  readonly id: string;
  readonly priceId: string;
  readonly name: string;
  readonly credits: number;
  readonly dailyCreditsLimit: number;
  readonly amount: number;
  readonly currency: string;
}

const SUBSCRIPTION_CREDITS = ENV_CONFIG.SUBSCRIPTION_PRICE_USD * ENV_CONFIG.CREDITS_PER_DOLLAR;

export const DEFAULT_SUBSCRIPTION_PLAN: SubscriptionPlan = {
  id: "monthly",
  priceId: ENV_CONFIG.STRIPE_PRICE_SUBSCRIPTION,
  name: "Monthly",
  credits: SUBSCRIPTION_CREDITS,
  dailyCreditsLimit: Math.floor(SUBSCRIPTION_CREDITS / 30),
  amount: ENV_CONFIG.SUBSCRIPTION_PRICE_USD,
  currency: "usd"
};

export const SUBSCRIPTION_PLANS: Readonly<Record<string, SubscriptionPlan>> =
  Object.freeze({
    monthly: DEFAULT_SUBSCRIPTION_PLAN
  });

export const getSubscriptionPlan = (id: string): SubscriptionPlan | undefined =>
  SUBSCRIPTION_PLANS[id];

export const getSubscriptionPlanByPriceId = (priceId: string): SubscriptionPlan | undefined =>
  Object.values(SUBSCRIPTION_PLANS).find((plan) => plan.priceId === priceId);
