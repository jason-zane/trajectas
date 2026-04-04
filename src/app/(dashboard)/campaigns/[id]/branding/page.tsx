import { notFound } from "next/navigation"
import { getCampaignById } from "@/app/actions/campaigns"
import { getBrandConfig, getEffectiveBrand } from "@/app/actions/brand"
import { CampaignBrandEditor } from "./campaign-brand-editor"

export default async function CampaignBrandingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const campaign = await getCampaignById(id)
  if (!campaign) notFound()

  const [campaignBrandRecord, inheritedBrand] = await Promise.all([
    getBrandConfig("campaign", id),
    getEffectiveBrand(campaign.organizationId),
  ])

  return (
    <CampaignBrandEditor
      campaignId={id}
      campaignTitle={campaign.title}
      organizationName={campaign.organizationName}
      initialRecord={campaignBrandRecord}
      inheritedBrand={inheritedBrand}
    />
  )
}
