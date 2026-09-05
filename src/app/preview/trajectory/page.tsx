import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { TrajectoryStudio } from '@/components/trajectory-studio/trajectory-studio'
import { createStudioDemo } from '@/lib/trajectory-studio/demo'
import type { Experience } from '@/lib/trajectory-studio/model'

export const metadata: Metadata = { title: 'Trajectory studio · Three experiences | Trajectas', description: 'An interactive exploration of Compare, individual Trajectory, and a unified Trajectory workspace using fictional data.', robots: { index: false, follow: false } }

export default async function TrajectoryPreview({ searchParams }: { searchParams: Promise<{ experience?: string }> }) {
  const params = await searchParams
  const nonce = (await headers()).get('x-nonce') ?? undefined
  const experience: Experience = params.experience === 'individual' || params.experience === 'unified' ? params.experience : 'compare'
  return <TrajectoryStudio nonce={nonce} dataset={createStudioDemo()} initialExperience={experience} />
}
