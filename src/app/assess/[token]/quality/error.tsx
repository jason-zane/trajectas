'use client'
import { BrandedError } from '@/components/errors/branded-error'
export default function ErrorPage({ error, reset, unstable_retry }: { error: Error; reset: () => void; unstable_retry?: () => void }) {
  return <BrandedError error={error} title="Unable to load the final statements" description="Your saved answers are retained. Please try again." reset={reset} unstable_retry={unstable_retry} />
}
