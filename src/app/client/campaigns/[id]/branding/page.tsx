import { notFound } from "next/navigation";
import { getCampaignById } from "@/app/actions/campaigns";
import { getBrandConfig, getEffectiveBrand } from "@/app/actions/brand";
import { CampaignBrandEditor } from "@/app/(dashboard)/campaigns/[id]/branding/campaign-brand-editor";

export default async function ClientCampaignBrandingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  const [campaignBrandRecord, inheritedBrand] = await Promise.all([
    getBrandConfig("campaign", id),
    getEffectiveBrand(campaign.clientId),
  ]);

  return (
    <CampaignBrandEditor
      campaignId={id}
      campaignTitle={campaign.title}
      clientName={campaign.clientName}
      initialRecord={campaignBrandRecord}
      inheritedBrand={inheritedBrand}
    />
  );
}
