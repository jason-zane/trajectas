import { WorkspaceFeatureUnavailable } from '@/components/workspace-feature-unavailable'
import { isWorkspaceFeatureEnabled } from '@/lib/features/access'
import { requireClientCampaignOwnership } from '@/lib/auth/resolve-client-org'
import { getCampaignById } from '@/app/actions/campaigns'
import { CampaignComparePageComponent } from '@/components/campaigns/pages/campaign-compare-page'

export default async function ClientCompareCampaignPage({
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

  if (!await isWorkspaceFeatureEnabled('compare')) return <WorkspaceFeatureUnavailable feature="compare" />
  const { id: campaignId } = await params
  const sp = await searchParams

  // Verify ownership before rendering comparison
  const campaign = await getCampaignById(campaignId)
  if (campaign) {
    await requireClientCampaignOwnership(campaign.clientId, `/client/campaigns/${campaignId}/compare`)
  }

  return (
    <CampaignComparePageComponent
      campaignId={campaignId}
      surface="client"
      searchParams={sp}
      basePath={`/client/campaigns/${campaignId}/compare`}
      fallbackPath="/client/campaigns"
    />
  )
}
