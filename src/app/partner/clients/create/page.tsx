import { redirect } from "next/navigation";
import { resolvePartnerOrg } from "@/lib/auth/resolve-partner-org";
import { ClientCreateForm } from "@/app/(dashboard)/clients/create/client-create-form";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function PartnerCreateClientPage() {
  const { partnerId } = await resolvePartnerOrg("/partner/clients/create");

  if (!partnerId) {
    redirect("/partner/clients");
  }

  const db = createAdminClient();
  const { data: partner } = await db
    .from("partners")
    .select("name")
    .eq("id", partnerId)
    .single();

  return (
    <ClientCreateForm
      partnerOptions={[]}
      canAssignPartner={false}
      fixedPartnerId={partnerId}
      fixedPartnerName={partner?.name ?? null}
    />
  );
}
