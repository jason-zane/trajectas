import { cache } from "react";
import { getCampaignById } from "@/app/actions/campaigns";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { CampaignDetailShell } from "./campaign-detail-shell";

const getCanCustomizeBranding = cache(async (clientId: string | null) => {
  if (!clientId) return true;

  const db = createAdminClient();
  const { data } = await db
    .from("clients")
    .select("can_customize_branding")
    .eq("id", clientId)
    .single();

  return data?.can_customize_branding ?? false;
});

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

  const canCustomizeBranding = await getCanCustomizeBranding(
    campaign.clientId ?? null
  );

  return (
    <CampaignDetailShell
      campaign={campaign}
      canCustomizeBranding={canCustomizeBranding}
    >
      {children}
    </CampaignDetailShell>
  );
}
