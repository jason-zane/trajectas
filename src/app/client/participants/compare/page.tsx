import { renderTrajectoryPage } from '@/lib/trajectory-studio/page'
import { ComparisonWorkspace } from '@/components/comparison/comparison-workspace'
import {
  getComparisonMatrix,
  getEligibleAssessmentsForParticipants,
} from '@/app/actions/comparison'
import {
  getSavedComparison,
  listSavedComparisons,
} from '@/app/actions/saved-comparisons'
import { getPlatformBandScheme } from '@/app/actions/platform-settings'
import { resolveClientOrg } from '@/lib/auth/resolve-client-org'
import { resolveSessionActor } from '@/lib/auth/actor'
import {
  decodeDeltaParam,
  decodeEntriesParam,
  decodeLevelsParam,
} from '@/lib/comparison/url-params'
import { isLongitudinal } from '@/lib/comparison/display'
import { PageHeader } from '@/components/page-header'
import type { ComparisonRequest, EntryRequest } from '@/lib/comparison/types'

const BASE_PATH = '/client/participants/compare'

export default async function ClientComparePage({
  searchParams,
}: {
  searchParams: Promise<{
    entries?: string
    assessments?: string
    levels?: string
    delta?: string
    ids?: string
    saved?: string
  }>
}) {
  await resolveClientOrg('/client/participants/compare')
  const sp = await searchParams

  // Keep saved assessment/session configurations on the existing comparison route.
  if (!sp.saved && !sp.entries && !sp.assessments && !sp.levels && !sp.delta) {
    return renderTrajectoryPage(sp, 'compare', 'client')
  }

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
  const subject = (() => {
    if (result.rows.length === 0) return 'Pick a participant to start a new comparison, or open a saved one.'
    if (longitudinal && personName) {
      return `${result.rows.length} sessions across ${aLabel}`
    }
    const count = result.rows.length
    return `${count} ${count === 1 ? 'participant' : 'participants'} across ${aLabel}`
  })()

  return (
    <div className="space-y-4 max-w-[1600px] min-w-0">
      <div className="px-4 pt-4">
        <PageHeader
          eyebrow={saved ? `Insights · ${saved.shareScope === 'team' ? 'Shared' : 'Private'}` : 'Insights'}
          title={saved?.name ?? (longitudinal && personName ? personName : 'Compare')}
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
        basePath={BASE_PATH}
        partnerBandScheme={null}
        platformBandScheme={platformBandScheme}
        pickerScope={{ kind: 'workspace' }}
        currentUserId={actor?.id ?? null}
      />
    </div>
  )
}
