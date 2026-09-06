import 'server-only'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
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

  const ids = [...new Set((params.ids ?? params.id ?? '').split(',').filter(Boolean))]
  if (ids.length > CANVAS_MAX_PEOPLE) throw new Error(`Choose up to ${CANVAS_MAX_PEOPLE} participants.`)
  const initial: CanvasResult = ids.length ? await getComparisonCanvas(ids) : { people: [], series: [], entities: [], clientId: null }
  const nonce = (await headers()).get('x-nonce') ?? undefined
  const initialLens = experience === 'individual' || (experience === 'unified' && (params.lens === 'time' || (!params.lens && params.id))) ? 'time' : 'snapshot'
  return <LiveTrajectoryStudio initial={initial} nonce={nonce} experience={experience} initialLens={initialLens} />
}
