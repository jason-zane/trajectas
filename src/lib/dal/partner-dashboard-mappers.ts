import type { CompletionTimelinePoint } from "@/app/actions/campaigns";

/**
 * Pure mappers for the partner dashboard. Split out from the DAL so the shapes
 * can be unit-tested without a database (see src/lib/dal/README.md).
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

/** Completions per UTC day, keyed YYYY-MM-DD. */
export function bucketCompletionsByDay(
  rows: Array<{ completed_at?: string | null }>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const ts = row.completed_at;
    if (!ts) continue;
    const day = ts.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
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

function displayName(row: {
  first_name?: string | null;
  last_name?: string | null;
  email: string;
}) {
  const name = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
  return name || row.email;
}

function related(value: unknown): Record<string, unknown> | null {
  const record = Array.isArray(value) ? value[0] : value;
  return record && typeof record === "object" ? (record as Record<string, unknown>) : null;
}

/**
 * Participant rows → recent-activity entries, newest first. Mirrors the client
 * portal's shape and adds the client name, which is what makes the list legible
 * when it spans a whole portfolio.
 */
export function mapRecentResultRows(rows: unknown[]): PartnerRecentResult[] {
  const results = rows.map((raw) => {
    const row = raw as Record<string, unknown>;
    const sessions = Array.isArray(row.participant_sessions)
      ? [...(row.participant_sessions as Array<Record<string, unknown>>)]
      : [];

    sessions.sort((a, b) => {
      const aTime = new Date(
        (a.completed_at as string) ?? (a.started_at as string) ?? 0,
      ).getTime();
      const bTime = new Date(
        (b.completed_at as string) ?? (b.started_at as string) ?? 0,
      ).getTime();
      return bTime - aTime;
    });

    const latestSession = sessions[0];
    const campaign = related(row.campaigns);
    const client = related(campaign?.clients);

    const lastActivity =
      (latestSession?.completed_at as string) ??
      (latestSession?.started_at as string) ??
      (row.completed_at as string) ??
      (row.started_at as string) ??
      (row.created_at as string);

    return {
      participantId: String(row.id),
      participantName: displayName(
        row as { first_name?: string | null; last_name?: string | null; email: string },
      ),
      participantEmail: String(row.email),
      campaignId: String(row.campaign_id),
      campaignTitle: campaign?.title ? String(campaign.title) : "Unknown",
      clientName: client?.name ? String(client.name) : "Unknown client",
      latestSessionId: latestSession?.id ? String(latestSession.id) : undefined,
      status: String(row.status),
      lastActivity: String(lastActivity),
    } satisfies PartnerRecentResult;
  });

  results.sort(
    (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime(),
  );
  return results;
}
