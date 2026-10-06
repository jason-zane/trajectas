
import { requireWorkspaceFeature } from '@/lib/features/access'
import "server-only";
import {
  requireAdminScope,
  requireClientAccess,
} from "@/lib/auth/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { readUsagePages } from "@/lib/dal/usage-report";
import { mapUsageSnapshotRow } from "@/lib/dal/billing-mappers";
import type { UsageSnapshot } from "@/types/database";

/** Existing frozen usage figures, including failed/no-invoice periods. Read only. */
export async function listClientUsageStatements(
  clientId: string,
): Promise<UsageSnapshot[]> {
  await requireWorkspaceFeature('usageVisibility')

  await requireAdminScope();
  await requireClientAccess(clientId, { includeArchived: true });
  const db = createAdminClient();
  const rows = await readUsagePages((offset, end) =>
    db
      .from("billing_usage_snapshots")
      .select("*, billing_accounts!inner(client_id)")
      .eq("billing_accounts.client_id", clientId)
      .order("period_start", { ascending: false })
      .order("id")
      .range(offset, end),
  );
  return rows.map(mapUsageSnapshotRow);
}
