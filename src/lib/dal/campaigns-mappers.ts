import { mapCampaignRow } from "@/lib/supabase/mappers";
import type { CampaignWithMeta } from "@/app/actions/campaigns";

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
