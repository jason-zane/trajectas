'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { ComparisonRequest } from '@/lib/comparison/types'

export function ComparisonExportButton({
  request,
  campaignSlug,
  disabled,
}: {
  request: ComparisonRequest
  campaignSlug?: string
  disabled?: boolean
}) {
  const [busy, setBusy] = useState(false)

  async function onClick() {
    setBusy(true)
    try {
      const res = await fetch('/api/comparison/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request, campaignSlug }),
      })
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const cd = res.headers.get('content-disposition') ?? ''
      const match = /filename="([^"]+)"/.exec(cd)
      const filename = match?.[1] ?? 'trajectas-comparison.csv'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error('Export failed', {
        description: e instanceof Error ? e.message : 'Unknown error',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button onClick={onClick} disabled={disabled || busy}>
      {busy ? 'Exporting…' : 'Export CSV'}
    </Button>
  )
}
