/**
 * Credits are stored as decimals on the backend (true fractional cost per call),
 * so a balance can be e.g. 499.463679. Show up to 2 decimal places, dropping
 * trailing zeros so whole balances stay clean (16, not 16.00).
 */
export function formatCredits(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}
