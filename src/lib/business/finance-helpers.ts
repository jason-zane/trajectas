/**
 * Pure roll-up helpers for the Business Centre — no I/O, so the money/time-series
 * maths is unit-tested independently of the DAL. `now` is always injected.
 */
import type { Invoice } from "@/types/database";

export interface SeriesPoint {
  /** "YYYY-MM" */
  key: string;
  /** Short month label, e.g. "Jun" */
  label: string;
  value: number;
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** UTC "YYYY-MM" key — matches Postgres date_trunc('month', ...) under UTC. */
export function toMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * A contiguous last-N-months series (oldest → newest, ending at `now`'s month),
 * pulling values from `valueByKey` and filling gaps with 0.
 */
export function monthlySeries(
  valueByKey: Map<string, number>,
  monthsBack: number,
  now: Date,
): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month - i, 1));
    const key = toMonthKey(d);
    out.push({ key, label: MONTH_LABELS[d.getUTCMonth()], value: valueByKey.get(key) ?? 0 });
  }
  return out;
}

const OPEN_STATUSES = new Set(["open", "uncollectible"]);

export interface InvoiceSummary {
  /** Sum of amount_due for open/uncollectible invoices (accounts receivable). */
  outstandingCents: number;
  invoicedThisMonthCents: number;
  paidThisMonthCents: number;
  /** Total invoiced per month, last `monthsBack` months. */
  invoicedTrend: SeriesPoint[];
}

export function summarizeInvoices(
  invoices: Invoice[],
  now: Date,
  monthsBack = 6,
): InvoiceSummary {
  const thisKey = toMonthKey(now);
  let outstandingCents = 0;
  let invoicedThisMonthCents = 0;
  let paidThisMonthCents = 0;
  const invoicedByMonth = new Map<string, number>();

  for (const inv of invoices) {
    if (OPEN_STATUSES.has(inv.status)) outstandingCents += inv.amountDueCents;

    const issued = inv.issuedAt ?? inv.created_at;
    if (issued) {
      const key = toMonthKey(new Date(issued));
      invoicedByMonth.set(key, (invoicedByMonth.get(key) ?? 0) + inv.totalCents);
      if (key === thisKey) invoicedThisMonthCents += inv.totalCents;
    }

    if (
      inv.status === "paid" &&
      inv.paidAt &&
      toMonthKey(new Date(inv.paidAt)) === thisKey
    ) {
      paidThisMonthCents += inv.amountPaidCents || inv.totalCents;
    }
  }

  return {
    outstandingCents,
    invoicedThisMonthCents,
    paidThisMonthCents,
    invoicedTrend: monthlySeries(invoicedByMonth, monthsBack, now),
  };
}
