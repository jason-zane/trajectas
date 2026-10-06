import { isWorkspaceFeatureEnabled } from '@/lib/features/access'
import { WorkspaceFeatureUnavailable } from '@/components/workspace-feature-unavailable'
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
  if (!await isWorkspaceFeatureEnabled('campaignViewing')) return <WorkspaceFeatureUnavailable feature="campaignViewing" />

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
