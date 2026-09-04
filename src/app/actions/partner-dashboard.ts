"use server";

import { requirePartnerAccess } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import {
  getPartnerCompletionTimeline,
  getRecentPartnerResults,
  listPartnerClientIds,
} from "@/lib/dal/partner-dashboard";
import type { PartnerRecentResult } from "@/lib/dal/partner-dashboard-mappers";
import type { CompletionTimelinePoint } from "@/app/actions/campaigns";

export type PartnerDashboardData = {
  completionTimeline: CompletionTimelinePoint[];
  recentResults: PartnerRecentResult[];
};

/**
 * Portfolio-wide activity for the partner dashboard: a 14-day completion
 * timeline and the latest participant movements. Reads run on the RLS client,
 * so the partner boundary holds in the database as well as here.
 */
export async function getPartnerDashboardData(
  partnerId: string,
): Promise<PartnerDashboardData> {
  await requirePartnerAccess(partnerId);
  const db = await createClient();

  const clientIds = await listPartnerClientIds(db, partnerId);
  const [completionTimeline, recentResults] = await Promise.all([
    getPartnerCompletionTimeline(db, clientIds, 14),
    getRecentPartnerResults(db, clientIds, 5),
  ]);

  return { completionTimeline, recentResults };
}
