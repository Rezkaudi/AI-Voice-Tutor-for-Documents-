/**
 * The UTC calendar day (YYYY-MM-DD) used as the billing/usage bucket key —
 * `Subscription.lastUsageResetDate` resets the daily allowance when this rolls over.
 */
export const todayKey = (): string => new Date().toISOString().slice(0, 10);
