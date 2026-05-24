import { ComparisonWorkspace } from '@/components/comparison/comparison-workspace'
import {
  getComparisonMatrix,
  getEligibleAssessmentsForParticipants,
  searchAllParticipants,
} from '@/app/actions/comparison'
import { getPlatformBandScheme } from '@/app/actions/platform-settings'
import {
  decodeDeltaParam,
  decodeEntriesParam,
  decodeLevelsParam,
} from '@/lib/comparison/url-params'
import { isLongitudinal } from '@/lib/comparison/display'
import { PageHeader } from '@/components/page-header'
import type { ComparisonRequest, EntryRequest } from '@/lib/comparison/types'

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{
    entries?: string
    assessments?: string
    levels?: string
    delta?: string
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

  const longitudinal = isLongitudinal(result.rows)
  const personName = result.rows[0]?.participantName ?? null
  const aCount = effectiveRequest.assessmentIds.length
  const aLabel = `${aCount} assessment${aCount === 1 ? '' : 's'}`
  const subject = (() => {
    if (result.rows.length === 0) return 'Pick participants to begin.'
    if (longitudinal && personName) {
      return `${result.rows.length} sessions across ${aLabel}`
    }
    const count = result.rows.length
    return `${count} ${count === 1 ? 'participant' : 'participants'} across ${aLabel}`
  })()

  return (
    <div className="space-y-4 max-w-[1600px]">
      <div className="px-4 pt-4">
        <PageHeader
          eyebrow="Insights"
          title={longitudinal && personName ? personName : 'Compare'}
          description={subject}
        />
      </div>
      <ComparisonWorkspace
        initial={{ request: effectiveRequest, result, eligible, deltaMode }}
        partnerBandScheme={null}
        platformBandScheme={platformBandScheme}
        searchSource={searchAllParticipants}
      />
    </div>
  )
}
