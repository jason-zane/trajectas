import { CampaignComparePageComponent } from '@/components/campaigns/pages/campaign-compare-page'

export default async function CompareCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    entries?: string
    assessments?: string
    levels?: string
    delta?: string
    ids?: string
    saved?: string
  }>
}) {
  const { id: campaignId } = await params
  const sp = await searchParams

  return (
    <CampaignComparePageComponent
      campaignId={campaignId}
      surface="admin"
      searchParams={sp}
      basePath={`/campaigns/${campaignId}/compare`}
      fallbackPath="/campaigns"
    />
  )
}
