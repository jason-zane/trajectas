import 'server-only'
import { MultipleTrajectoryPeopleError } from '@/lib/features/workspace-features'
import { WorkspaceFeatureUnavailable } from '@/components/workspace-feature-unavailable'
import { EXPERIENCE_FEATURE } from '@/lib/features/workspace-features'
import { requireInsightExperience, isWorkspaceFeatureEnabled } from '@/lib/features/access'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getComparisonCanvas } from '@/app/actions/canvas'
import { requireAdminScope } from '@/lib/auth/authorization'
import { resolvePartnerOrg } from '@/lib/auth/resolve-partner-org'
import { resolveClientOrg } from '@/lib/auth/resolve-client-org'
import { LiveTrajectoryStudio } from '@/components/trajectory-studio/studio-live'
import { CANVAS_MAX_PEOPLE } from '@/lib/validations/canvas'
import type { CanvasResult } from '@/lib/canvas/types'
import type { Experience } from './model'

export type TrajectoryPageParams = { id?: string; ids?: string; lens?: string }

// Experience and portal come from the server route, never a URL mode parameter.
export async function renderTrajectoryPage(params: TrajectoryPageParams, experience: Experience, portal: 'admin' | 'partner' | 'client') {
  if (portal === 'client' && experience === 'unified') notFound()
  const route = experience === 'individual' ? 'trajectory' : experience
  if (portal === 'admin') await requireAdminScope()
  else if (portal === 'partner') await resolvePartnerOrg(`/partner/participants/${route}`)
  else await resolveClientOrg(`/client/participants/${route}`)

  if (!await isWorkspaceFeatureEnabled(EXPERIENCE_FEATURE[experience])) return <WorkspaceFeatureUnavailable feature={EXPERIENCE_FEATURE[experience]} />
  await requireInsightExperience(experience)
  const ids = [...new Set((params.ids ?? params.id ?? '').split(',').filter(Boolean))]
  if (ids.length > CANVAS_MAX_PEOPLE) throw new Error(`Choose up to ${CANVAS_MAX_PEOPLE} participants.`)
  let initial: CanvasResult = { people: [], series: [], entities: [], clientId: null }
  if (ids.length) {
    try { initial = await getComparisonCanvas(ids, experience) }
    catch (error) {
      if (!(error instanceof MultipleTrajectoryPeopleError) || portal === 'client') throw error
      await requireInsightExperience('unified')
      const query = new URLSearchParams({ ids: ids.join(','), lens: 'time' })
      redirect(`${portal === 'partner' ? '/partner' : ''}/participants/unified?${query}`)
    }
  }
  // Existing admin links can carry several distinct people. Keep that history
  // comparison intact while the standalone Trajectory stays individual.
  if (experience === 'individual' && portal !== 'client' && initial.people.length > 1) {
    await requireInsightExperience('unified')
    const query = new URLSearchParams({ ids: ids.join(','), lens: 'time' })
    redirect(`${portal === 'partner' ? '/partner' : ''}/participants/unified?${query}`)
  }
  const nonce = (await headers()).get('x-nonce') ?? undefined
  const initialLens = experience === 'individual' || (experience === 'unified' && (params.lens === 'time' || (!params.lens && params.id))) ? 'time' : 'snapshot'
  return <LiveTrajectoryStudio initial={initial} nonce={nonce} experience={experience} initialLens={initialLens} />
}
