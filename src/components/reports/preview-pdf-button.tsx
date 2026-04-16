'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface PreviewPdfButtonProps {
  templateId: string
  assessmentId: string | null
}

export function PreviewPdfButton({ templateId, assessmentId }: PreviewPdfButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (!assessmentId) {
      toast.error('Choose an assessment first.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `/api/report-templates/${templateId}/preview/pdf?assessment=${encodeURIComponent(assessmentId)}`,
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = `template-${templateId}-preview.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'PDF download failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={loading || !assessmentId}>
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
      {loading ? 'Preparing…' : 'Download PDF'}
    </Button>
  )
}
