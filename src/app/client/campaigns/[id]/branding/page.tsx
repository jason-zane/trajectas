import { notFound } from "next/navigation";
import { getCampaignById } from "@/app/actions/campaigns";
import { getBrandConfig, getEffectiveBrand } from "@/app/actions/brand";
import { createAdminClient } from "@/lib/supabase/admin";
import { CampaignBrandEditor } from "@/app/(dashboard)/campaigns/[id]/branding/campaign-brand-editor";

export default async function ClientCampaignBrandingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  const [campaignBrandRecord, inheritedBrand, clientBrand] = await Promise.all([
    getBrandConfig("campaign", id),
    getEffectiveBrand(campaign.clientId),
    campaign.clientId ? getBrandConfig("client", campaign.clientId) : Promise.resolve(null),
  ]);

  let inheritedFrom = "TalentFit (platform default)";
  if (clientBrand) {
    inheritedFrom = campaign.clientName ?? "Client";
  } else if (campaign.partnerId) {
    const partnerBrand = await getBrandConfig("partner", campaign.partnerId);
    if (partnerBrand) {
      const db = createAdminClient();
      const { data: partner } = await db
        .from("partners")
        .select("name")
        .eq("id", campaign.partnerId)
        .single();
      inheritedFrom = partner?.name ?? "Partner";
    }
  }

  return (
    <CampaignBrandEditor
      campaignId={id}
      campaignTitle={campaign.title}
      inheritedFrom={inheritedFrom}
      initialRecord={campaignBrandRecord}
      inheritedBrand={inheritedBrand}
    />
  );
}
