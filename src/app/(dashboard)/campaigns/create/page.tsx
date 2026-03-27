import { CampaignForm } from "../campaign-form";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapOrganizationRow } from "@/lib/supabase/mappers";

export default async function CreateCampaignPage() {
  const db = createAdminClient();
  const { data } = await db
    .from("organizations")
    .select("*")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name");

  const organizations = (data ?? []).map(mapOrganizationRow);

  return <CampaignForm mode="create" organizations={organizations} />;
}
