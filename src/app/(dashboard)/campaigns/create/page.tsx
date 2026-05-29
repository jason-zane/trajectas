import { CampaignForm } from "../campaign-form";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapClientRow } from "@/lib/supabase/mappers";

export default async function CreateCampaignPage() {
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
