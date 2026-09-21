'use client'
import { BrandedError } from '@/components/errors/branded-error'
export default function ErrorPage(props: { error: Error; reset: () => void; unstable_retry?: () => void }) { return <BrandedError {...props} title="Model controls couldn't load" /> }
