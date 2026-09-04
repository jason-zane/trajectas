import type { CompletionTimelinePoint } from "@/app/actions/campaigns";

/**
 * Pure mappers for the partner dashboard. Split out from the DAL so the shapes
 * can be unit-tested without a database (see src/lib/dal/README.md).
 *
 * Both panels are aggregated and ordered in Postgres (see the
 * `partner_dashboard_*` functions), so these mappers only rename fields and
 * pad the series — they never sort or truncate. Doing either here is what made
 * the pre-aggregation version wrong past PostgREST's 1000-row cap.
 */

/** A dense day-by-day series, so a sparkline never shows a gap as a gap. */
export function zeroFilledTimeline(
  days: number,
  counts?: Map<string, number>,
): CompletionTimelinePoint[] {
  const out: CompletionTimelinePoint[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, count: counts?.get(key) ?? 0 });
  }
  return out;
}

/** Per-day totals from the timeline projection, keyed YYYY-MM-DD. */
export function mapCompletionTimelineRows(
  rows: Array<{ day?: string | null; completions?: number | string | null }>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.day) continue;
    // `count(*)` arrives as bigint, which the driver hands back as a string.
    const total = Number(row.completions ?? 0);
    if (!Number.isFinite(total)) continue;
    counts.set(String(row.day).slice(0, 10), total);
  }
  return counts;
}

export type PartnerRecentResult = {
  participantId: string;
  participantName: string;
  participantEmail: string;
  campaignId: string;
  campaignTitle: string;
  clientName: string;
  latestSessionId?: string;
  status: string;
  lastActivity: string;
};

type RecentResultRow = {
  participant_id?: string | null;
  participant_name?: string | null;
  participant_email?: string | null;
  campaign_id?: string | null;
  campaign_title?: string | null;
  client_name?: string | null;
  latest_session_id?: string | null;
  status?: string | null;
  last_activity?: string | null;
};

/**
 * Recent-activity rows → DTOs. The projection already returns them newest
 * first and limited, so the order that arrives is the order that renders.
 */
export function mapRecentResultRows(rows: unknown[]): PartnerRecentResult[] {
  return rows.map((raw) => {
    const row = (raw ?? {}) as RecentResultRow;
    return {
      participantId: String(row.participant_id ?? ""),
      participantName: String(row.participant_name ?? row.participant_email ?? ""),
      participantEmail: String(row.participant_email ?? ""),
      campaignId: String(row.campaign_id ?? ""),
      campaignTitle: row.campaign_title ? String(row.campaign_title) : "Unknown",
      clientName: row.client_name ? String(row.client_name) : "Unknown client",
      latestSessionId: row.latest_session_id ? String(row.latest_session_id) : undefined,
      status: String(row.status ?? ""),
      lastActivity: String(row.last_activity ?? ""),
    } satisfies PartnerRecentResult;
  });
}
