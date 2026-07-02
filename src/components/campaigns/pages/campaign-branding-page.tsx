import { notFound } from "next/navigation"
import { getCampaignHeader } from "@/app/actions/campaigns"
import { getBrandConfig, getEffectiveBrand } from "@/app/actions/brand"
import { getPartnerName } from "@/lib/dal/partners"
import { CampaignBrandEditor } from "@/app/(dashboard)/campaigns/[id]/branding/campaign-brand-editor"

interface CampaignBrandingPageProps {
  campaignId: string;
}

export async function CampaignBrandingPageComponent({
  campaignId,
}: CampaignBrandingPageProps) {
  const campaign = await getCampaignHeader(campaignId)
  if (!campaign) notFound()

  const [campaignBrandRecord, inheritedBrand, clientBrand, partnerBrand] = await Promise.all([
    getBrandConfig("campaign", campaignId),
    getEffectiveBrand(campaign.clientId),
    campaign.clientId ? getBrandConfig("client", campaign.clientId) : Promise.resolve(null),
    campaign.partnerId ? getBrandConfig("partner", campaign.partnerId) : Promise.resolve(null),
  ])

  // Determine which tier supplies the inherited brand (most specific with overrides)
  let inheritedFrom = "Trajectas (platform default)"
  if (clientBrand?.config && Object.keys(clientBrand.config).length > 0) {
    inheritedFrom = campaign.clientName ?? "Client"
  } else if (partnerBrand?.config && Object.keys(partnerBrand.config).length > 0 && campaign.partnerId) {
    inheritedFrom = (await getPartnerName(campaign.partnerId)) ?? "Partner"
  }

  return (
    <CampaignBrandEditor
      campaignId={campaignId}
      campaignTitle={campaign.title}
      inheritedFrom={inheritedFrom}
      initialRecord={campaignBrandRecord}
      inheritedBrand={inheritedBrand}
    />
  )
}
