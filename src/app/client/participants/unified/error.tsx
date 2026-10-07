'use client'
import { BrandedError } from '@/components/errors/branded-error'
export default function TrajectoryError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <BrandedError {...props} homeHref="/client/participants/unified" homeLabel="Unified Trajectory" />
}
