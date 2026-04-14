'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, useTransition } from 'react'
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import {
  getCampaignSessionReportRows,
  retrySnapshot,
  type AudienceType,
} from '@/app/actions/reports'
import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LocalTime } from '@/components/local-time'
import {
  getReportStatusLabel,
  getReportStatusVariant,
  isReportGenerating,
  isReportViewable,
} from '@/lib/reports/status'

type CampaignSessionReportPanelRow = Awaited<
  ReturnType<typeof getCampaignSessionReportRows>
>[number]

interface CampaignSessionReportsPanelProps {
  sessionId: string
  initialRows: CampaignSessionReportPanelRow[]
  reportBasePath: string
  settingsHref?: string
}

function audienceLabel(audienceType: AudienceType) {
  if (audienceType === 'participant') return 'Participant'
  if (audienceType === 'hr_manager') return 'HR Manager'
  return 'Consultant'
}

export function CampaignSessionReportsPanel({
  sessionId,
  initialRows,
  reportBasePath,
  settingsHref,
}: CampaignSessionReportsPanelProps) {
  const [rows, setRows] = useState(initialRows)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [, startTransition] = useTransition()

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const nextRows = await getCampaignSessionReportRows(sessionId)
      setRows(nextRows)
    } catch {
      toast.error('Failed to refresh report status')
    } finally {
      setIsRefreshing(false)
    }
  }, [sessionId])

  useEffect(() => {
    if (!rows.some((row) => isReportGenerating(row.status))) {
      return
    }

    const interval = window.setInterval(() => {
      void refresh()
    }, 3000)

    return () => window.clearInterval(interval)
  }, [refresh, rows])

  function handleRetry(snapshotId: string) {
    startTransition(async () => {
      try {
        await retrySnapshot(snapshotId)
        toast.success('Retrying report generation')
        await refresh()
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to retry report generation'
        )
      }
    })
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No report templates configured for this campaign"
        description={
          settingsHref
            ? 'Assign report templates in campaign settings to generate reports for completed sessions.'
            : 'Assign report templates in the campaign configuration to generate reports for completed sessions.'
        }
        actionLabel={settingsHref ? 'Open campaign settings' : undefined}
        actionHref={settingsHref}
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template name</TableHead>
              <TableHead>Who it&apos;s for</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-48">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.audienceType}:${row.templateId}`}>
                <TableCell>
                  <div className="space-y-1">
                    <p className="font-medium">{row.templateName}</p>
                    {row.generatedAt ? (
                      <p className="text-caption text-muted-foreground">
                        Generated{' '}
                        <LocalTime iso={row.generatedAt} format="relative" />
                      </p>
                    ) : null}
                    {row.errorMessage ? (
                      <p className="text-caption text-destructive">{row.errorMessage}</p>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{audienceLabel(row.audienceType)}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={getReportStatusVariant(row.status)}>
                    {getReportStatusLabel(row.status)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {row.snapshotId && isReportViewable(row.status) ? (
                    <Button
                      variant="outline"
                      size="sm"
                      render={
                        <Link
                          href={`${reportBasePath}/${row.snapshotId}`}
                          target="_blank"
                          rel="noreferrer"
                        />
                      }
                    >
                      View
                      <ExternalLink className="size-3.5" />
                    </Button>
                  ) : row.snapshotId && row.status === 'failed' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRetry(row.snapshotId!)}
                    >
                      Retry
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled>
                      {isReportGenerating(row.status) ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        'Unavailable'
                      )}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
