'use client'

import { useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { fetchWithTimeout } from '@/lib/net/fetch-with-timeout'
import { createTrajectorySnapshot } from '@/app/actions/canvas'
import type { CanvasViewState } from '@/lib/canvas/types'

/**
 * Export affordances for the canvas: CSV of the breakdown, and the PDF
 * growth report (freezes the canvas into a snapshot, then downloads the
 * rendered PDF — figures in the report never drift afterwards).
 */
export function CanvasExportBar({
  campaignParticipantIds,
  viewState,
  peopleCount,
  sessionCount,
}: {
  campaignParticipantIds: string[]
  viewState: CanvasViewState
  peopleCount: number
  sessionCount: number
}) {
  const [exporting, setExporting] = useState(false)
  const [generating, setGenerating] = useState(false)

  async function exportCsv() {
    setExporting(true)
    try {
      const res = await fetchWithTimeout('/api/trajectory/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignParticipantIds }),
        timeoutMs: 30_000,
      })
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const cd = res.headers.get('content-disposition') ?? ''
      const match = /filename="([^"]+)"/.exec(cd)
      const filename = match?.[1] ?? 'trajectas-trajectory.csv'
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
      setExporting(false)
    }
  }

  async function generateReport() {
    setGenerating(true)
    try {
      const { snapshotId } = await createTrajectorySnapshot({
        campaignParticipantIds,
        viewState,
      })
      const res = await fetchWithTimeout(`/api/trajectory/snapshots/${snapshotId}/pdf`, {
        timeoutMs: 60_000,
      })
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const cd = res.headers.get('content-disposition') ?? ''
      const match = /filename="([^"]+)"/.exec(cd)
      const filename = match?.[1] ?? 'trajectas-growth-report.pdf'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Growth report generated', {
        description: 'The figures are frozen — this report will not change as new results arrive.',
      })
    } catch (e) {
      toast.error('Report generation failed', {
        description: e instanceof Error ? e.message : 'Unknown error',
      })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
      <p className="text-xs text-muted-foreground">
        {peopleCount} {peopleCount === 1 ? 'person' : 'people'} · {sessionCount} completed{' '}
        assessment{sessionCount === 1 ? '' : 's'} · exports include every competency
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={exporting}>
          <Download className="size-4" />
          {exporting ? 'Exporting…' : 'Export CSV'}
        </Button>
        <Button size="sm" onClick={generateReport} disabled={generating}>
          <FileText className="size-4" />
          {generating ? 'Generating…' : 'Generate report'}
        </Button>
      </div>
    </div>
  )
}
