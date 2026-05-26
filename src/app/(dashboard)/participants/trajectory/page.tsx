import { TrajectoryLanding } from '@/components/trajectory/trajectory-landing'
import { TrajectoryWorkspace } from '@/components/trajectory/trajectory-workspace'
import { getTrajectoryLandingData } from '@/app/actions/trajectory'
import { loadTrajectoryForParticipant } from '@/lib/trajectory/load'

/**
 * Standalone Trajectory page — Shape B (admin tree).
 * Renders the landing surface (stats + recents + search) by default; with
 * `?id=<cpId>`, renders the full trajectory workspace for that person.
 */
export default async function AdminTrajectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams

  return (
    <div className="space-y-6 max-w-7xl">
      <header className="px-1">
        <p className="text-xs uppercase tracking-widest opacity-60">Trajectory</p>
        <h1 className="text-xl font-semibold">
          {id ? 'Person trajectory' : 'Find a person'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {id
            ? 'A single person’s scoring across every assessment they’ve completed within the client.'
            : 'Pick someone you’ve seen recently — or search by name or email.'}
        </p>
      </header>

      {id ? (
        <TrajectoryWorkspace
          campaignParticipantId={id}
          initialResult={await loadTrajectoryForParticipant(id, 'admin-trajectory-page')}
        />
      ) : (
        <TrajectoryLanding
          basePath="/participants/trajectory"
          initial={await getTrajectoryLandingData()}
        />
      )}
    </div>
  )
}
