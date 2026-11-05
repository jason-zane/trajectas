'use client'
import { useEffect, type ReactNode } from 'react'
import { useRouter, useSelectedLayoutSegment } from 'next/navigation'

export function ParticipantPrivacyGate({ required, token, children }: { required: boolean; token: string; children: ReactNode }) {
  const router = useRouter()
  const segment = useSelectedLayoutSegment()
  const blocked = required && segment !== 'consent'
  useEffect(() => { if (blocked) router.replace(`/assess/${token}/consent`) }, [blocked, router, token])
  return blocked ? <p role="status" className="p-6 text-center">Please review the assessment information before continuing.</p> : children
}
