import { redirect } from 'next/navigation'
import { ComparisonWorkspace } from '@/components/comparison/comparison-workspace'
import {
  getComparisonMatrix,
  getEligibleAssessmentsForParticipants,
  searchCampaignParticipants,
} from '@/app/actions/comparison'
import { getCampaignById } from '@/app/actions/campaigns'
import { getPlatformBandScheme } from '@/app/actions/platform-settings'
import { requireClientCampaignOwnership } from '@/lib/auth/resolve-client-org'
import {
  decodeDeltaParam,
  decodeEntriesParam,
  decodeLevelsParam,
} from '@/lib/comparison/url-params'
import { isLongitudinal } from '@/lib/comparison/display'
import { PageHeader } from '@/components/page-header'
import type { ComparisonRequest, EntryRequest } from '@/lib/comparison/types'

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
  }>
}) {
  const { id: campaignId } = await params
  const sp = await searchParams
  const campaign = await getCampaignById(campaignId)
  if (!campaign) redirect('/client/campaigns')
  await requireClientCampaignOwnership(campaign.clientId, `/client/campaigns/${campaignId}/compare`)

  const initialEntryIds = sp.ids ? sp.ids.split(',').filter(Boolean) : []
  const decoded = decodeEntriesParam(sp.entries)
  const entries: EntryRequest[] = decoded.length
    ? decoded
    : initialEntryIds.map((id) => ({ campaignParticipantId: id }))
  const assessmentIds = sp.assessments ? sp.assessments.split(',').filter(Boolean) : []
  const visibleLevels = decodeLevelsParam(sp.levels)
  const deltaMode = decodeDeltaParam(sp.delta)

  const eligible = await getEligibleAssessmentsForParticipants(
    entries.map((e) => e.campaignParticipantId),
  )

  const effectiveRequest: ComparisonRequest = {
    entries,
    assessmentIds:
      assessmentIds.length === 0
        ? eligible.map((a) => a.assessmentId).slice(0, 5)
        : assessmentIds,
    visibleLevels,
  }

  const result = await getComparisonMatrix(effectiveRequest)
  const platformBandScheme = await getPlatformBandScheme()

  const searchSource = (query: string) => searchCampaignParticipants(campaignId, query)

  const longitudinal = isLongitudinal(result.rows)
  const personName = result.rows[0]?.participantName ?? null
  const aCount = effectiveRequest.assessmentIds.length
  const aLabel = `${aCount} assessment${aCount === 1 ? '' : 's'}`
  const subject =
    result.rows.length === 0
      ? `Pick participants in ${campaign.title} to begin.`
      : longitudinal && personName
        ? `${result.rows.length} sessions across ${aLabel} · ${campaign.title}`
        : `${result.rows.length} ${result.rows.length === 1 ? 'participant' : 'participants'} across ${aLabel} · ${campaign.title}`

  return (
    <div className="space-y-4 max-w-[1600px]">
      <div className="px-4 pt-4">
        <PageHeader
          eyebrow="Insights · Campaign"
          title={longitudinal && personName ? personName : campaign.title}
          description={subject}
        />
      </div>
      <ComparisonWorkspace
        initial={{ request: effectiveRequest, result, eligible, deltaMode }}
        campaignSlug={campaign.slug}
        partnerBandScheme={null}
        platformBandScheme={platformBandScheme}
        searchSource={searchSource}
      />
    </div>
  )
}
