"use client"
import { ErrorBoundaryCard } from '@/components/errors/error-boundary-card'
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorBoundaryCard error={error} reset={reset} title="Unable to load reference groups" description="Try again, or check that reference catalog migrations are installed." />
}
