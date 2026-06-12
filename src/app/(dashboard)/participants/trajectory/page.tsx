import { TrajectoryLanding } from '@/components/trajectory/trajectory-landing'
import { CanvasPageView } from '@/components/canvas/canvas-page'
import { getTrajectoryLandingData } from '@/app/actions/trajectory'
import { CANVAS_MAX_PEOPLE } from '@/lib/validations/canvas'

/**
 * Standalone Trajectory page — Shape B (admin tree).
 *
 * Renders the landing surface (stats + recents + search) by default; with
 * `?id=<cpId>` (one person) or `?ids=<cpId,…>` (up to 8 people) it renders
 * the trajectory canvas: hero chart over time + competency breakdown.
 * Adding people on the canvas turns a single trajectory into a
 * candidates-over-time comparison without leaving the section.
 */
export default async function AdminTrajectoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    id?: string
    ids?: string
    chart?: string
    order?: string
    change?: string
  }>
}) {
  const sp = await searchParams
  const ids = sp.ids
    ? sp.ids.split(',').filter(Boolean)
    : sp.id
      ? [sp.id]
      : []

  if (ids.length > 0) {
    return (
      <CanvasPageView
        ids={ids.slice(0, CANVAS_MAX_PEOPLE)}
        chart={sp.chart}
        order={sp.order}
        change={sp.change}
        basePath="/participants/trajectory"
      />
    )
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <header className="px-1">
        <p className="text-xs uppercase tracking-widest opacity-60">Trajectory</p>
        <h1 className="text-xl font-semibold">Find a person</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pick someone you’ve seen recently — or search by name or email.
        </p>
      </header>
      <TrajectoryLanding
        basePath="/participants/trajectory"
        initial={await getTrajectoryLandingData()}
      />
    </div>
  )
}
