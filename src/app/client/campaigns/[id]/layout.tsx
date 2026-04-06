import { getCampaignById } from "@/app/actions/campaigns";
import { resolveClientOrg } from "@/lib/auth/resolve-client-org";
import { notFound } from "next/navigation";
import { CampaignDetailShell } from "@/app/(dashboard)/campaigns/[id]/campaign-detail-shell";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function ClientCampaignDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { clientId } = await resolveClientOrg("/client/campaigns");

  const { id } = await params;
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  // Security: verify campaign belongs to the active client
  if (!clientId || campaign.clientId !== clientId) {
    notFound();
  }

  let canCustomizeBranding = false;
  if (campaign.clientId) {
    const db = createAdminClient();
    const { data } = await db
      .from("clients")
      .select("can_customize_branding")
      .eq("id", campaign.clientId)
      .single();
    canCustomizeBranding = data?.can_customize_branding ?? false;
  }

  return (
    <CampaignDetailShell
      campaign={campaign}
      canCustomizeBranding={canCustomizeBranding}
    >
      {children}
    </CampaignDetailShell>
  );
}
