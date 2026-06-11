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

  const [campaignBrandRecord, inheritedBrand, clientBrand] = await Promise.all([
    getBrandConfig("campaign", campaignId),
    getEffectiveBrand(campaign.clientId),
    campaign.clientId ? getBrandConfig("client", campaign.clientId) : Promise.resolve(null),
  ])

  let inheritedFrom = "Trajectas (platform default)"
  if (clientBrand) {
    inheritedFrom = campaign.clientName ?? "Client"
  } else if (campaign.partnerId) {
    const partnerBrand = await getBrandConfig("partner", campaign.partnerId)
    if (partnerBrand) {
      inheritedFrom = (await getPartnerName(campaign.partnerId)) ?? "Partner"
    }
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
