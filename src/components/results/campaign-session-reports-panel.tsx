'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { ExternalLink, Loader2, Mail, RefreshCw, Send } from 'lucide-react'
import { toast } from 'sonner'
import {
  getCampaignSessionReportRows,
  retrySnapshot,
  regenerateSnapshot,
  sendReportToCandidate,
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


// Poll quickly while generation is making visible progress, back off to
// POLL_MAX_MS while statuses are unchanged, stop when nothing is generating.
const POLL_MIN_MS = 3000
const POLL_MAX_MS = 15_000
const POLL_BACKOFF_FACTOR = 1.5

export function CampaignSessionReportsPanel({
  sessionId,
  initialRows,
  reportBasePath,
  settingsHref,
}: CampaignSessionReportsPanelProps) {
  const [rows, setRows] = useState(initialRows)
  const [isRefreshing, setIsRefreshing] = useState(false)
  // Bumped after every refresh attempt (success or failure) so the polling
  // effect reschedules even when the row data — and thus its identity —
  // didn't change (e.g. transient fetch error).
  const [pollEpoch, setPollEpoch] = useState(0)
  const [, startTransition] = useTransition()
  const pollDelayRef = useRef(POLL_MIN_MS)
  const lastPollSignatureRef = useRef('')

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const nextRows = await getCampaignSessionReportRows(sessionId)
      setRows(nextRows)
    } catch {
      toast.error('Failed to refresh report status')
    } finally {
      setIsRefreshing(false)
      setPollEpoch((epoch) => epoch + 1)
    }
  }, [sessionId])

  useEffect(() => {
    if (!rows.some((row) => isReportGenerating(row.status))) {
      pollDelayRef.current = POLL_MIN_MS
      lastPollSignatureRef.current = ''
      return
    }

    const signature = rows
      .map((row) => `${row.templateId}:${row.snapshotId ?? ''}:${row.status}`)
      .join('|')
    if (signature !== lastPollSignatureRef.current) {
      lastPollSignatureRef.current = signature
      pollDelayRef.current = POLL_MIN_MS
    } else {
      pollDelayRef.current = Math.min(
        Math.round(pollDelayRef.current * POLL_BACKOFF_FACTOR),
        POLL_MAX_MS,
      )
    }

    const timeout = window.setTimeout(() => {
      void refresh()
    }, pollDelayRef.current)

    return () => window.clearTimeout(timeout)
  }, [refresh, rows, pollEpoch])

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

  function handleRegenerate(snapshotId: string) {
    startTransition(async () => {
      try {
        await regenerateSnapshot(snapshotId)
        toast.success('Regenerating report')
        await refresh()
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to regenerate report'
        )
      }
    })
  }

  function handleSend(snapshotId: string, alreadySent: boolean) {
    startTransition(async () => {
      try {
        await sendReportToCandidate(snapshotId)
        toast.success(alreadySent ? 'Report sent again' : 'Report sent to candidate')
        await refresh()
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to send report'
        )
      }
    })
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No reports for this session"
        description={
          settingsHref
            ? "There are no reports bound to this session's assessment, no campaign-level extras, and no platform fallback. Attach a default report on the assessment, or add one to this campaign in settings."
            : "There are no reports bound to this session's assessment, no campaign-level extras, and no platform fallback. Attach a default report on the assessment, or add one to this campaign."
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
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.templateId}>
                <TableCell>
                  <div className="space-y-1">
                    <p className="font-medium">{row.templateName}</p>
                    {row.generatedAt ? (
                      <p className="text-caption text-muted-foreground">
                        Generated{' '}
                        <LocalTime iso={row.generatedAt} format="relative" />
                      </p>
                    ) : null}
                    {row.sentToParticipantAt ? (
                      <p className="text-caption text-muted-foreground">
                        Sent to candidate{' '}
                        <LocalTime iso={row.sentToParticipantAt} format="relative" />
                      </p>
                    ) : null}
                    {row.errorMessage ? (
                      <p className="text-caption text-destructive">{row.errorMessage}</p>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={getReportStatusVariant(row.status)}>
                    {getReportStatusLabel(row.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {row.snapshotId && isReportViewable(row.status) ? (
                    <div className="flex flex-nowrap items-center justify-end gap-2 whitespace-nowrap">
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleSend(row.snapshotId!, Boolean(row.sentToParticipantAt))
                        }
                      >
                        {row.sentToParticipantAt ? (
                          <Mail className="size-3.5" />
                        ) : (
                          <Send className="size-3.5" />
                        )}
                        {row.sentToParticipantAt ? 'Send again' : 'Send to candidate'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRegenerate(row.snapshotId!)}
                      >
                        <RefreshCw className="size-3.5" />
                        Regenerate
                      </Button>
                    </div>
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
