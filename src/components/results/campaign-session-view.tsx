import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LocalTime } from '@/components/local-time'
import { getSessionProcessingStatusLabel } from '@/lib/assess/session-processing'
import { SessionScoresPanel } from '@/components/results/session-scores-panel'
import { CampaignSessionReportsPanel } from '@/components/results/campaign-session-reports-panel'
import { getCampaignSessionReportRows } from '@/app/actions/reports'
import type { SessionDetail } from '@/app/actions/sessions'

interface CampaignSessionViewProps {
  session: SessionDetail
  reportRows: Awaited<ReturnType<typeof getCampaignSessionReportRows>>
  backHref: string
  backLabel: string
  reportBasePath: string
  settingsHref?: string
}

function sessionStatusVariant(
  status: string
): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'completed') return 'default'
  if (status === 'in_progress') return 'secondary'
  if (status === 'expired') return 'destructive'
  return 'outline'
}

function processingVariant(
  status: string
): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'ready') return 'default'
  if (status === 'scoring' || status === 'reporting') return 'secondary'
  if (status === 'failed') return 'destructive'
  return 'outline'
}

export function CampaignSessionView({
  session,
  reportRows,
  backHref,
  backLabel,
  reportBasePath,
  settingsHref,
}: CampaignSessionViewProps) {
  const durationLabel =
    session.durationMinutes == null
      ? '—'
      : session.durationMinutes < 1
        ? '<1 min'
        : session.durationMinutes < 60
          ? `${session.durationMinutes}m`
          : `${Math.floor(session.durationMinutes / 60)}h ${session.durationMinutes % 60}m`
  const showProcessingBanner =
    session.processingStatus === 'scoring' ||
    session.processingStatus === 'reporting' ||
    session.processingStatus === 'failed'

  return (
    <div className="max-w-6xl space-y-8">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>

      <PageHeader
        eyebrow={session.campaignTitle}
        title={session.participantName}
        description={session.participantEmail}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={sessionStatusVariant(session.status)}>
            {session.status}
          </Badge>
          {session.status === 'completed' ? (
            <Badge variant={processingVariant(session.processingStatus)}>
              {getSessionProcessingStatusLabel(session.processingStatus)}
            </Badge>
          ) : null}
        </div>
      </PageHeader>

      {showProcessingBanner ? (
        <Card
          className={
            session.processingStatus === 'failed'
              ? 'border-destructive/30 bg-destructive/5'
              : 'border-primary/15 bg-primary/5'
          }
        >
          <CardContent className="py-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={processingVariant(session.processingStatus)}>
                {getSessionProcessingStatusLabel(session.processingStatus)}
              </Badge>
              <span className="font-medium">
                {session.processingStatus === 'scoring'
                  ? 'This session is still being scored.'
                  : session.processingStatus === 'reporting'
                    ? 'Scores are ready and report generation is still running.'
                    : 'This session completed, but downstream processing failed.'}
              </span>
            </div>
            {session.processingError ? (
              <p className="mt-2 text-muted-foreground">{session.processingError}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="py-5">
            <p className="text-caption text-muted-foreground">Assessment</p>
            <p className="mt-1 text-lg font-semibold">{session.assessmentTitle}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-caption text-muted-foreground">Attempt</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {session.attemptNumber}/{session.totalAttempts}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-caption text-muted-foreground">Duration</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{durationLabel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-caption text-muted-foreground">Factors scored</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {session.scores.length}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
        <p>
          Started: <LocalTime iso={session.startedAt} format="date-time" />
        </p>
        <p>
          Completed: <LocalTime iso={session.completedAt} format="date-time" />
        </p>
        <p>
          Processed: <LocalTime iso={session.processedAt} format="date-time" />
        </p>
      </div>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Scores</h2>
          <p className="text-sm text-muted-foreground">
            Existing factor and dimension scores for this completed session.
          </p>
        </div>
        <SessionScoresPanel
          scores={session.scores}
          sessionStatus={session.status}
          processingStatus={session.processingStatus}
          processingError={session.processingError}
        />
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Reports</h2>
          <p className="text-sm text-muted-foreground">
            Campaign-configured report templates for this participant session.
          </p>
        </div>
        <CampaignSessionReportsPanel
          sessionId={session.id}
          initialRows={reportRows}
          reportBasePath={reportBasePath}
          settingsHref={settingsHref}
        />
      </section>
    </div>
  )
}
