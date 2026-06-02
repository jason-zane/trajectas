import { mapCampaignRow } from "@/lib/supabase/mappers";
import type {
  CampaignSessionRow,
  CampaignWithMeta,
} from "@/app/actions/campaigns";

/**
 * Pure row → DTO transforms for the campaigns DAL.
 *
 * I/O-free (no Supabase, no `server-only`) so the mapping logic is unit-tested
 * and coverage-gated. The query functions in `campaigns.ts` call these after
 * fetching rows. See src/lib/dal/README.md.
 */

/**
 * Map `campaigns_with_counts` view rows (which inline assessment/participant/
 * completed counts + an embedded `clients(name)`) to CampaignWithMeta DTOs.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapCampaignWithCountsRows(rows: any[]): CampaignWithMeta[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (rows ?? []).map((row: any) => ({
    ...mapCampaignRow(row),
    assessmentCount: row.assessment_count ?? 0,
    participantCount: row.participant_count ?? 0,
    completedCount: row.completed_count ?? 0,
    clientName: row.clients?.name ?? undefined,
  }));
}

/** Unwrap a possibly-array PostgREST embedded relation to a single row (or null). */
function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Map participant_sessions rows (joined to assessments + campaign_participants)
 * to CampaignSessionRow DTOs: assigns a 1-based attempt number per
 * (participant, assessment) in chronological order, then re-sorts newest first
 * for display. Input must already be ordered oldest-first by started_at.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapCampaignSessionRows(rows: any[]): CampaignSessionRow[] {
  const attemptCounter = new Map<string, number>();
  const mapped: CampaignSessionRow[] = (rows ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (row: any) => {
      const assessment = unwrap(row.assessments);
      const cp = unwrap(row.campaign_participants);
      const name = `${cp?.first_name ?? ""} ${cp?.last_name ?? ""}`.trim();
      const key = `${row.campaign_participant_id}|${row.assessment_id}`;
      const attemptNumber = (attemptCounter.get(key) ?? 0) + 1;
      attemptCounter.set(key, attemptNumber);
      return {
        id: row.id,
        campaignParticipantId: row.campaign_participant_id,
        participantName: name || cp?.email || "Unknown",
        participantEmail: cp?.email ?? "",
        assessmentId: row.assessment_id,
        assessmentTitle: assessment?.title ?? "Untitled assessment",
        status: row.status,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        attemptNumber,
      };
    },
  );

  mapped.sort((a, b) => {
    const ad = a.completedAt ?? a.startedAt ?? "";
    const bd = b.completedAt ?? b.startedAt ?? "";
    return bd.localeCompare(ad);
  });
  return mapped;
}
