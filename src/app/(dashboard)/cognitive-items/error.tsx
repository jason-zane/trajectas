'use client'

import { BrandedError } from '@/components/errors/branded-error'

/**
 * Covers the whole /cognitive-items tree. Every read on this surface goes through an
 * admin-scoped Server Action, so the common failure here is an authorization
 * throw rather than a data error — the copy stays generic on purpose and the
 * message is surfaced by BrandedError itself.
 */
export default function ItemBankError(props: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <BrandedError
      {...props}
      eyebrow="Item bank"
      title="We could not load the item bank."
      homeHref="/cognitive-items"
      homeLabel="Item bank"
    />
  )
}
