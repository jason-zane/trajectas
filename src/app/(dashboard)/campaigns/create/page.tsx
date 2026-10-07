import { isWorkspaceFeatureEnabled } from '@/lib/features/access'
import { WorkspaceFeatureUnavailable } from '@/components/workspace-feature-unavailable'
import { connection } from "next/server"
import { CampaignForm } from "../campaign-form";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapClientRow } from "@/lib/supabase/mappers";

export default async function CreateCampaignPage() {
  if (!await isWorkspaceFeatureEnabled('campaignManagement') || !await isWorkspaceFeatureEnabled('assessmentDelivery')) return <WorkspaceFeatureUnavailable feature="campaignManagement" />

  await connection()
  const db = createAdminClient();
  const { data } = await db
    .from("clients")
    .select("*")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name");

  const clients = (data ?? []).map(mapClientRow);

  // 360 campaign type is offered only in the admin dashboard (test-bed scope).
  return <CampaignForm mode="create" clients={clients} allowLeadership360 />;
}
