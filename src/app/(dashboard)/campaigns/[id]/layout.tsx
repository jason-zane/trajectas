import { getCampaignById } from "@/app/actions/campaigns";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { CampaignDetailShell } from "./campaign-detail-shell";

export default async function CampaignDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  let canCustomizeBranding = true;

  if (campaign.organizationId) {
    const db = createAdminClient();
    const { data } = await db
      .from("organizations")
      .select("can_customize_branding")
      .eq("id", campaign.organizationId)
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
