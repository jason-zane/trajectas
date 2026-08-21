'use client'

import { useState } from 'react'
import { Loader2, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { EmptyState } from '@/components/empty-state'
import { cn } from '@/lib/utils'
import type { SoundnessReport, SoundnessFinding } from '@/lib/instrument/soundness'

export interface SoundnessPanelProps {
  report: SoundnessReport | null
  isRunning?: boolean
  onRun: () => void
  className?: string
}

function getRelativeTime(isoString: string | null): string {
  if (!isoString) return ''
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function FindingRow({ finding }: { finding: SoundnessFinding }) {
  const alertVariant = {
    critical: 'destructive',
    warning: 'warning',
    advisory: 'info',
    ok: 'default',
  }[finding.severity] as 'destructive' | 'warning' | 'info' | 'default'

  return (
    <Alert variant={alertVariant} className="space-y-2">
      <div>
        <div className="font-medium text-sm">{finding.title}</div>
        <div className="text-sm text-muted-foreground mt-1">{finding.detail}</div>
      </div>
      {finding.constructNames.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {finding.constructNames.map((name, idx) => (
            <Badge key={idx} variant="outline" className="text-xs">
              {name}
            </Badge>
          ))}
        </div>
      )}
      <div className="text-xs border-l-2 border-current/30 pl-2.5 py-1 text-muted-foreground">
        {finding.guidance}
      </div>
    </Alert>
  )
}

export function SoundnessPanel({
  report,
  isRunning = false,
  onRun,
  className,
}: SoundnessPanelProps) {
  const [showAdvisories, setShowAdvisories] = useState(false)

  // Empty state: no report yet
  if (report === null) {
    return (
      <div className={className}>
        <EmptyState
          size="sm"
          title="Check your model"
          description="This checks construct overlap, definition quality, and whether your reliability target is reachable."
        />
        <div className="flex justify-center mt-6">
          <Button onClick={onRun} disabled={isRunning}>
            {isRunning && <Loader2 className="size-4 animate-spin mr-2" />}
            {isRunning ? 'Checking…' : 'Check model'}
          </Button>
        </div>
      </div>
    )
  }

  // Group findings by severity
  const criticals = report.findings.filter((f) => f.severity === 'critical')
  const warnings = report.findings.filter((f) => f.severity === 'warning')
  const advisories = report.findings.filter((f) => f.severity === 'advisory')
  const hasAnyFindings = criticals.length > 0 || warnings.length > 0 || advisories.length > 0

  // Badge carries no success/warning variant, so the band paints itself from the
  // same tokens Alert uses — keeping the score chip and the findings below it in
  // one colour language.
  const bandStyle =
    report.band === 'sound'
      ? 'border-transparent bg-primary/12 text-primary'
      : report.band === 'needs-work'
        ? 'border-transparent bg-[var(--gold)]/15 text-[var(--gold)]'
        : 'border-transparent bg-destructive/12 text-destructive'

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header row */}
      <div className="space-y-2">
        <div className="flex items-baseline gap-3">
          <div className="font-heading text-3xl font-bold tabular-nums">
            {report.score}
          </div>
          <Badge variant="outline" className={cn('text-xs font-semibold', bandStyle)}>
            {report.band.replace('-', ' ')}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{report.summary}</p>
        {report.checkedAt && (
          <p className="text-xs text-muted-foreground/60">
            Checked {getRelativeTime(report.checkedAt)}
          </p>
        )}
      </div>

      {/* Check/Re-check button */}
      <Button onClick={onRun} disabled={isRunning} variant="outline">
        {isRunning && <Loader2 className="size-4 animate-spin mr-2" />}
        {isRunning ? 'Checking…' : 'Re-check model'}
      </Button>

      {/* Findings or clean bill */}
      {!hasAnyFindings ? (
        <Alert variant="success">
          <AlertDescription className="font-medium">
            {report.summary}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-4">
          {/* Critical findings */}
          {criticals.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-widest text-destructive/70">
                Critical issues ({criticals.length})
              </div>
              {criticals.map((finding, idx) => (
                <FindingRow key={`${finding.code}:${finding.constructNames.join("|")}:${idx}`} finding={finding} />
              ))}
            </div>
          )}

          {/* Warning findings */}
          {warnings.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-widest text-[var(--gold)]/70">
                Warnings ({warnings.length})
              </div>
              {warnings.map((finding, idx) => (
                <FindingRow key={`${finding.code}:${finding.constructNames.join("|")}:${idx}`} finding={finding} />
              ))}
            </div>
          )}

          {/* Advisory findings (collapsible if > 3) */}
          {advisories.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="text-xs font-semibold uppercase tracking-widest text-info/70">
                  Advisory notes ({advisories.length})
                </div>
              </div>

              {advisories.length <= 3 ? (
                advisories.map((finding, idx) => (
                  <FindingRow key={`${finding.code}:${finding.constructNames.join("|")}:${idx}`} finding={finding} />
                ))
              ) : (
                <>
                  {advisories.slice(0, 3).map((finding, idx) => (
                    <FindingRow key={`${finding.code}:${finding.constructNames.join("|")}:${idx}`} finding={finding} />
                  ))}
                  <button
                    onClick={() => setShowAdvisories(!showAdvisories)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border/50 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted/50"
                  >
                    <ChevronDown
                      className={cn(
                        'size-4 transition-transform',
                        showAdvisories && 'rotate-180'
                      )}
                    />
                    {showAdvisories
                      ? 'Hide advisory notes'
                      : `Show ${advisories.length - 3} more advisory note${advisories.length - 3 !== 1 ? 's' : ''}`}
                  </button>
                  {showAdvisories &&
                    advisories.slice(3).map((finding, idx) => (
                      <FindingRow key={`${finding.code}:${finding.constructNames.join("|")}:${idx}`} finding={finding} />
                    ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
