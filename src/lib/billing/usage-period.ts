/**
 * Pure helpers for usage-billing period maths — no I/O, so they're unit-tested
 * and the cron stays a thin wrapper. `now` is injected for determinism.
 */

export interface BillingPeriod {
  /** ISO start, inclusive. */
  start: string;
  /** ISO end, exclusive. */
  end: string;
  /** Human label for invoice/snapshot copy, e.g. "June 2026". */
  label: string;
}

/**
 * The most recently completed calendar month (UTC) relative to `now`. Run on
 * the 1st, this is the month that just ended.
 */
export function previousMonthPeriod(now: Date): BillingPeriod {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const label = new Intl.DateTimeFormat("en-AU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(start);
  return { start: start.toISOString(), end: end.toISOString(), label };
}

/** quantity × unit price, both rounded to whole units/cents and floored at 0. */
export function computeUsageAmountCents(
  quantity: number,
  unitPriceCents: number,
): number {
  return Math.max(0, Math.round(quantity) * Math.round(unitPriceCents));
}
