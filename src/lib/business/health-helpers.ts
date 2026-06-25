/**
 * Pure account-health classification from a client's monthly usage series.
 * No I/O — unit-tested. Input is a contiguous oldest→newest series of completed
 * assessments per month (e.g. the last 6 months from `monthlySeries`).
 */
import type { SeriesPoint } from "@/lib/business/finance-helpers";

export type UsageHealth = "growing" | "steady" | "declining" | "dormant" | "none";

export const HEALTH_LABEL: Record<UsageHealth, string> = {
  growing: "Growing",
  steady: "Steady",
  declining: "Declining",
  dormant: "Dormant",
  none: "No usage",
};

/**
 * Classify a client's recent usage:
 * - `none`     — no completed assessments in the window
 * - `dormant`  — had usage, but nothing in the last 3 months
 * - `growing`  — last 3 months materially above the prior 3
 * - `declining`— last 3 months materially below the prior 3
 * - `steady`   — otherwise
 */
export function classifyUsageHealth(series: SeriesPoint[]): UsageHealth {
  const n = series.length;
  if (n === 0) return "none";

  const total = series.reduce((sum, p) => sum + p.value, 0);
  if (total === 0) return "none";

  let lastActive = -1;
  for (let i = n - 1; i >= 0; i--) {
    if (series[i].value > 0) {
      lastActive = i;
      break;
    }
  }
  const monthsSinceActive = n - 1 - lastActive;
  if (monthsSinceActive >= 3) return "dormant";

  const recent = series.slice(Math.max(0, n - 3)).reduce((s, p) => s + p.value, 0);
  const prior = series
    .slice(Math.max(0, n - 6), Math.max(0, n - 3))
    .reduce((s, p) => s + p.value, 0);

  if (prior === 0) return recent > 0 ? "growing" : "steady";
  if (recent > prior * 1.3) return "growing";
  if (recent < prior * 0.7) return "declining";
  return "steady";
}

/** Statuses that warrant operator attention (surfaced on the overview). */
export function needsAttention(status: UsageHealth): boolean {
  return status === "declining" || status === "dormant";
}
