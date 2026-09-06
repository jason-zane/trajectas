'use client'
import { BrandedError } from '@/components/errors/branded-error'
export default function StudioError(props: { error: Error & { digest?: string }; reset: () => void }) { return <BrandedError {...props} homeHref="/participants/trajectory" homeLabel="Trajectory" /> }
