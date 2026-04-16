'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import type { PreviewAssessmentOption } from '@/app/actions/reports'

interface Props {
  templateId: string
  assessments: PreviewAssessmentOption[]
  selectedAssessmentId: string | null
}

export function PreviewAssessmentSelector({
  templateId,
  assessments,
  selectedAssessmentId,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  if (assessments.length === 0) return null

  return (
    <select
      value={selectedAssessmentId ?? ''}
      onChange={(e) => {
        const next = e.target.value
        startTransition(() => {
          router.replace(
            `/report-templates/${templateId}/preview?assessment=${encodeURIComponent(next)}`,
          )
        })
      }}
      className="rounded-md border border-border bg-background px-2 py-1 text-xs"
      aria-label="Preview as assessment"
    >
      {assessments.map((a) => (
        <option key={a.id} value={a.id}>
          {a.title}
        </option>
      ))}
    </select>
  )
}
