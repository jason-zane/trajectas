import type { Metadata } from 'next'
import { renderTrajectoryPage, type TrajectoryPageParams } from '@/lib/trajectory-studio/page'

export const metadata: Metadata = { title: 'Trajectory | Trajectas' }

export default async function TrajectoryPage({ searchParams }: { searchParams: Promise<TrajectoryPageParams> }) {
  return renderTrajectoryPage(await searchParams, 'individual', 'client')
}
