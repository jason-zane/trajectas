import { redirect } from 'next/navigation'
import { ComparisonWorkspace } from '@/components/comparison/comparison-workspace'
import {
  getComparisonMatrix,
  getEligibleAssessmentsForParticipants,
} from '@/app/actions/comparison'
import { getCampaignById } from '@/app/actions/campaigns'
import {
  getSavedComparison,
  listSavedComparisons,
} from '@/app/actions/saved-comparisons'
import { getPlatformBandScheme } from '@/app/actions/platform-settings'
import { resolveSessionActor } from '@/lib/auth/actor'
import {
  decodeDeltaParam,
  decodeEntriesParam,
  decodeLevelsParam,
} from '@/lib/comparison/url-params'
import { isLongitudinal } from '@/lib/comparison/display'
import { PageHeader } from '@/components/page-header'
import type { ComparisonRequest, EntryRequest } from '@/lib/comparison/types'

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
  const campaign = await getCampaignById(campaignId)
  if (!campaign) redirect('/campaigns')

  const saved = sp.saved ? await getSavedComparison(sp.saved) : null

  const initialEntryIds = sp.ids ? sp.ids.split(',').filter(Boolean) : []
  const decoded = decodeEntriesParam(sp.entries)
  const entries: EntryRequest[] = decoded.length
    ? decoded
    : initialEntryIds.length
      ? initialEntryIds.map((id) => ({ campaignParticipantId: id }))
      : (saved?.entries ?? [])
  const assessmentIds = sp.assessments
    ? sp.assessments.split(',').filter(Boolean)
    : (saved?.assessmentIds ?? [])
  const visibleLevels = sp.levels
    ? decodeLevelsParam(sp.levels)
    : (saved?.visibleLevels ?? decodeLevelsParam(undefined))
  const deltaMode = sp.delta !== undefined ? decodeDeltaParam(sp.delta) : (saved?.deltaMode ?? false)

  const [eligible, savedList, actor] = await Promise.all([
    getEligibleAssessmentsForParticipants(entries.map((e) => e.campaignParticipantId)),
    listSavedComparisons(),
    resolveSessionActor(),
  ])

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
    <div className="space-y-4 max-w-[1600px] min-w-0">
      <div className="px-4 pt-4">
        <PageHeader
          eyebrow="Insights · Campaign"
          title={longitudinal && personName ? personName : campaign.title}
          description={subject}
        />
      </div>
      <ComparisonWorkspace
        initial={{
          request: effectiveRequest,
          result,
          eligible,
          deltaMode,
          saved,
          savedList,
        }}
        basePath={`/campaigns/${campaignId}/compare`}
        campaignSlug={campaign.slug}
        partnerBandScheme={null}
        platformBandScheme={platformBandScheme}
        pickerScope={{ kind: 'campaign', campaignId }}
        currentUserId={actor?.id ?? null}
      />
    </div>
  )
}
