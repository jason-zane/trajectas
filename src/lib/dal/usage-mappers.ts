/**
 * Pure aggregation for the per-client usage view.
 *
 * I/O-free (no Supabase, no `server-only`) so the roll-up maths is unit-tested
 * independently of the queries in `usage.ts`. Counts originate from the
 * `campaigns_with_counts` view, which already excludes 360 raters and
 * soft-deleted participants. See README.md.
 */
import type { ClientUsageRow } from "@/types/database";

export interface UsageClientInput {
  id: string;
  name: string;
  isActive: boolean;
}

export interface UsageCampaignInput {
  clientId: string | null;
  status: string | null;
  participantCount: number;
  completedCount: number;
  /** Timestamp used to derive "last activity" (campaign updated/created). */
  activityAt: string | null;
}

interface Tally {
  campaignsTotal: number;
  campaignsActive: number;
  invited: number;
  completed: number;
  lastActivityAt: string | null;
}

function emptyTally(): Tally {
  return {
    campaignsTotal: 0,
    campaignsActive: 0,
    invited: 0,
    completed: 0,
    lastActivityAt: null,
  };
}

/**
 * Roll campaign rows up to one row per client. Every client is represented
 * (even with zero campaigns), sorted by assessments completed (desc) then name.
 */
export function aggregateClientUsage(
  clients: UsageClientInput[],
  campaigns: UsageCampaignInput[],
): ClientUsageRow[] {
  const byClient = new Map<string, Tally>();

  for (const campaign of campaigns) {
    if (!campaign.clientId) continue;
    const tally = byClient.get(campaign.clientId) ?? emptyTally();
    tally.campaignsTotal += 1;
    if (campaign.status === "active") tally.campaignsActive += 1;
    tally.invited += campaign.participantCount;
    tally.completed += campaign.completedCount;
    if (
      campaign.activityAt &&
      (!tally.lastActivityAt || campaign.activityAt > tally.lastActivityAt)
    ) {
      tally.lastActivityAt = campaign.activityAt;
    }
    byClient.set(campaign.clientId, tally);
  }

  return clients
    .map((client) => {
      const tally = byClient.get(client.id) ?? emptyTally();
      return {
        clientId: client.id,
        clientName: client.name,
        isActive: client.isActive,
        campaignsTotal: tally.campaignsTotal,
        campaignsActive: tally.campaignsActive,
        participantsInvited: tally.invited,
        assessmentsCompleted: tally.completed,
        completionRate: tally.invited > 0 ? tally.completed / tally.invited : null,
        lastActivityAt: tally.lastActivityAt,
      };
    })
    .sort(
      (a, b) =>
        b.assessmentsCompleted - a.assessmentsCompleted ||
        a.clientName.localeCompare(b.clientName),
    );
}
