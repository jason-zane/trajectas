import { ComparisonWorkspace } from '@/components/comparison/comparison-workspace'
import {
  getComparisonMatrix,
  getEligibleAssessmentsForParticipants,
  searchAllParticipants,
} from '@/app/actions/comparison'
import { getPlatformBandScheme } from '@/app/actions/platform-settings'
import { decodeEntriesParam, decodeLevelsParam } from '@/lib/comparison/url-params'
import type { ComparisonRequest, EntryRequest } from '@/lib/comparison/types'

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{
    entries?: string
    assessments?: string
    levels?: string
    ids?: string
  }>
}) {
  const sp = await searchParams

  const initialEntryIds = sp.ids ? sp.ids.split(',').filter(Boolean) : []
  const decoded = decodeEntriesParam(sp.entries)
  const entries: EntryRequest[] = decoded.length
    ? decoded
    : initialEntryIds.map((id) => ({ campaignParticipantId: id }))
  const assessmentIds = sp.assessments ? sp.assessments.split(',').filter(Boolean) : []
  const visibleLevels = decodeLevelsParam(sp.levels)

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

  return (
    <div className="space-y-4 max-w-7xl">
      <header className="px-4 pt-4">
        <p className="text-xs uppercase tracking-widest opacity-60">Compare</p>
        <h1 className="text-xl font-semibold">Participants</h1>
      </header>
      <ComparisonWorkspace
        initial={{ request: effectiveRequest, result, eligible }}
        partnerBandScheme={null}
        platformBandScheme={platformBandScheme}
        searchSource={searchAllParticipants}
      />
    </div>
  )
}
