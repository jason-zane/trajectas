import { redirect } from 'next/navigation'
import { ComparisonWorkspace } from '@/components/comparison/comparison-workspace'
import {
  getComparisonMatrix,
  getEligibleAssessmentsForParticipants,
  searchCampaignParticipants,
} from '@/app/actions/comparison'
import { getCampaignById } from '@/app/actions/campaigns'
import { getPlatformBandScheme } from '@/app/actions/platform-settings'
import type {
  ComparisonRequest,
  EntryRequest,
  Granularity,
} from '@/lib/comparison/types'

function decodeEntries(s: string | null): EntryRequest[] {
  if (!s) return []
  try {
    return JSON.parse(decodeURIComponent(s)) as EntryRequest[]
  } catch {
    return []
  }
}

export default async function CompareCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    entries?: string
    assessments?: string
    granularity?: Granularity
    ids?: string
  }>
}) {
  const { id: campaignId } = await params
  const sp = await searchParams
  const campaign = await getCampaignById(campaignId)
  if (!campaign) redirect('/campaigns')

  const initialEntryIds = sp.ids ? sp.ids.split(',').filter(Boolean) : []
  const decoded = decodeEntries(sp.entries ?? null)
  const entries: EntryRequest[] = decoded.length
    ? decoded
    : initialEntryIds.map((id) => ({ campaignParticipantId: id }))
  const assessmentIds = sp.assessments ? sp.assessments.split(',').filter(Boolean) : []
  const granularity: Granularity =
    sp.granularity === 'dimensions' ? 'dimensions' : 'factors_or_constructs'

  const eligible = await getEligibleAssessmentsForParticipants(
    entries.map((e) => e.campaignParticipantId),
  )

  const effectiveRequest: ComparisonRequest = {
    entries,
    assessmentIds:
      assessmentIds.length === 0
        ? eligible.map((a) => a.assessmentId).slice(0, 5)
        : assessmentIds,
    granularity,
  }

  const result = await getComparisonMatrix(effectiveRequest)
  const platformBandScheme = await getPlatformBandScheme()

  const searchSource = (query: string) => searchCampaignParticipants(campaignId, query)

  return (
    <div className="space-y-4 max-w-7xl">
      <header className="px-4 pt-4">
        <p className="text-xs uppercase tracking-widest opacity-60">Compare</p>
        <h1 className="text-xl font-semibold">{campaign.title}</h1>
      </header>
      <ComparisonWorkspace
        initial={{ request: effectiveRequest, result, eligible }}
        campaignSlug={campaign.slug}
        partnerBandScheme={null}
        platformBandScheme={platformBandScheme}
        searchSource={searchSource}
      />
    </div>
  )
}
