import { TrajectoryPersonPicker } from '@/components/trajectory/trajectory-person-picker'
import { TrajectoryWorkspace } from '@/components/trajectory/trajectory-workspace'
import { loadTrajectoryForParticipant } from '@/lib/trajectory/load'

/**
 * Standalone Trajectory page — Shape B (client tree).
 */
export default async function ClientTrajectoryPage({
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
            ? 'A single person’s scoring across every assessment they’ve completed.'
            : 'Search for a participant to view their full assessment history over time.'}
        </p>
      </header>

      {id ? (
        <TrajectoryWorkspace
          campaignParticipantId={id}
          initialResult={await loadTrajectoryForParticipant(id, 'client-trajectory-page')}
        />
      ) : (
        <TrajectoryPersonPicker basePath="/client/participants/trajectory" />
      )}
    </div>
  )
}
