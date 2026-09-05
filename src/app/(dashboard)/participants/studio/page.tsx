import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { getComparisonCanvas } from '@/app/actions/canvas'
import { LiveTrajectoryStudio } from '@/components/trajectory-studio/studio-live'
import { CANVAS_MAX_PEOPLE } from '@/lib/validations/canvas'
import type { CanvasResult } from '@/lib/canvas/types'
import type { Experience } from '@/lib/trajectory-studio/model'

export const metadata: Metadata = { title: 'Trajectory studio | Trajectas' }

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ ids?: string; experience?: string }> }) {
  const params = await searchParams
  const nonce = (await headers()).get('x-nonce') ?? undefined
  const ids = [...new Set(params.ids?.split(',').filter(Boolean) ?? [])]
  if (ids.length > CANVAS_MAX_PEOPLE) throw new Error(`Choose up to ${CANVAS_MAX_PEOPLE} participants for the studio.`)
  const initial: CanvasResult = ids.length ? await getComparisonCanvas(ids) : { people: [], series: [], entities: [], clientId: null }
  const experience: Experience = params.experience === 'individual' || params.experience === 'unified' ? params.experience : 'compare'
  return <LiveTrajectoryStudio nonce={nonce} initial={initial} experience={experience} />
}
