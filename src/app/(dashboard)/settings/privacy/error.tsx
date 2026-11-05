'use client'
import { BrandedError } from '@/components/errors/branded-error'
export default function PrivacyError(props: { error: Error & { digest?: string }; reset: () => void; unstable_retry?: () => void }) {
  return <BrandedError {...props} title="Privacy settings are unavailable." description="Check your administrator access and the privacy migration, then retry." />
}
