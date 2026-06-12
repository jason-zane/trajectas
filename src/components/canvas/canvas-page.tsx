import { getComparisonCanvas } from '@/app/actions/canvas'
import { PageHeader } from '@/components/page-header'
import { monthYear } from '@/lib/canvas/summarize'
import {
  CANVAS_ORDERS,
  OVERALL_ID,
  type CanvasOrder,
} from '@/lib/canvas/types'
import { CanvasWorkspace } from './canvas-workspace'

/**
 * Server wrapper for the canvas: fetches the multi-person payload and
 * renders the page header + workspace. Lives under the Trajectory routes;
 * the Compare section keeps its matrix workspace, reachable from here via
 * the "Open in Compare" cross-link.
 */

export async function CanvasPageView({
  ids,
  chart,
  order,
  change,
  basePath,
}: {
  ids: string[]
  chart?: string
  order?: string
  change?: string
  basePath: string
}) {
  const result = await getComparisonCanvas(ids)
  const people = result.people

  const title =
    people.length === 1
      ? people[0].displayName
      : people.length === 2
        ? `${people[0].displayName} vs ${people[1].displayName}`
        : `Comparing ${people.length} people`

  const totalSessions = people.reduce((acc, p) => acc + p.completedSessionCount, 0)
  const since = monthYear(
    people.reduce<string | null>(
      (acc, p) =>
        p.firstCompletedAt && (!acc || p.firstCompletedAt < acc) ? p.firstCompletedAt : acc,
      null,
    ),
  )
  const until = monthYear(
    people.reduce<string | null>(
      (acc, p) =>
        p.lastCompletedAt && (!acc || p.lastCompletedAt > acc) ? p.lastCompletedAt : acc,
      null,
    ),
  )
  const description =
    totalSessions === 0
      ? 'No completed assessments yet.'
      : `${totalSessions} completed assessment${totalSessions === 1 ? '' : 's'}` +
        (since && until ? ` · ${since === until ? since : `${since} – ${until}`}` : '')

  const validChart =
    chart && (chart === OVERALL_ID || result.entities.some((e) => e.id === chart))
      ? chart
      : undefined
  const validOrder = CANVAS_ORDERS.includes(order as CanvasOrder)
    ? (order as CanvasOrder)
    : undefined
  const compareBase = basePath.startsWith('/client/')
    ? '/client/participants/compare'
    : '/participants/compare'
  const compareHref = `${compareBase}?ids=${people.map((p) => p.entryCpId).join(',')}`

  return (
    <div className="space-y-4 max-w-[1600px] min-w-0">
      <div className="px-4 pt-4">
        <PageHeader
          eyebrow="Insights · Trajectory"
          title={title}
          description={description}
        />
      </div>
      <CanvasWorkspace
        initial={result}
        initialCharted={validChart}
        initialOrder={validOrder}
        initialShowChange={change !== '0'}
        basePath={basePath}
        compareHref={compareHref}
      />
    </div>
  )
}
