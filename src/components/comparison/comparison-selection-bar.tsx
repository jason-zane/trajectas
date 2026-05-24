'use client'
import { Plus, X, TrendingUp, ArrowRightLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ComparisonExportButton } from './comparison-export-button'
import { cn } from '@/lib/utils'
import { getInitials, representativeSession } from '@/lib/comparison/display'
import type {
  ColumnLevel,
  ComparisonRequest,
  ComparisonRow,
} from '@/lib/comparison/types'
import type { EligibleAssessment } from '@/app/actions/comparison'

const LEVEL_LABEL: Record<ColumnLevel, string> = {
  dimension: 'Dimensions',
  factor: 'Factors',
  construct: 'Constructs',
}

export function ComparisonSelectionBar({
  rows,
  request,
  visibleLevels,
  campaignSlug,
  eligibleAssessments,
  deltaMode,
  longitudinal,
  saveSlot,
  onRemoveEntry,
  onAddEntryClick,
  onToggleAssessment,
  onToggleLevel,
  onToggleDelta,
}: {
  rows: ComparisonRow[]
  request: ComparisonRequest
  visibleLevels: ColumnLevel[]
  campaignSlug?: string
  eligibleAssessments: EligibleAssessment[]
  deltaMode: boolean
  longitudinal: boolean
  saveSlot?: React.ReactNode
  onRemoveEntry: (entryId: string) => void
  onAddEntryClick: () => void
  onToggleAssessment: (assessmentId: string) => void
  onToggleLevel: (level: ColumnLevel) => void
  onToggleDelta: () => void
}) {
  const isEmpty = request.entries.length === 0
  return (
    <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {/* Row 1 — participants */}
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-2">
        <span className="text-overline text-muted-foreground mr-1">
          {longitudinal ? 'Sessions' : 'Participants'}
        </span>
        {rows.map((r) => (
          <ParticipantChip
            key={r.entryId}
            row={r}
            longitudinal={longitudinal}
            onRemove={() => onRemoveEntry(r.entryId)}
          />
        ))}
        <Button variant="outline" size="sm" onClick={onAddEntryClick} className="h-7 rounded-full">
          <Plus className="size-3.5" />
          Add {longitudinal ? 'session' : 'participant'}
        </Button>
      </div>

      {/* Row 2 — controls */}
      <div className="flex flex-wrap items-center gap-3 px-4 pb-3">
        <SegmentedToggle
          label="Assessments"
          items={eligibleAssessments.map((a) => ({
            key: a.assessmentId,
            label: a.assessmentName,
            badge: a.completedSessionCount,
          }))}
          active={request.assessmentIds}
          onToggle={onToggleAssessment}
        />

        <div className="h-5 w-px bg-border" />

        <SegmentedToggle
          label="Show"
          items={(['dimension', 'factor', 'construct'] as ColumnLevel[]).map((l) => ({
            key: l,
            label: LEVEL_LABEL[l],
          }))}
          active={visibleLevels as string[]}
          onToggle={(k) => onToggleLevel(k as ColumnLevel)}
        />

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleDelta}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              deltaMode
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background hover:bg-muted',
            )}
            aria-pressed={deltaMode}
            title={deltaMode ? 'Show absolute scores' : 'Show delta from group mean'}
          >
            {deltaMode ? (
              <ArrowRightLeft className="size-3.5" />
            ) : (
              <TrendingUp className="size-3.5" />
            )}
            Δ vs mean
          </button>
          {saveSlot}
          <ComparisonExportButton
            request={request}
            campaignSlug={campaignSlug}
            disabled={isEmpty}
          />
        </div>
      </div>
    </div>
  )
}

function ParticipantChip({
  row,
  longitudinal,
  onRemove,
}: {
  row: ComparisonRow
  longitudinal: boolean
  onRemove: () => void
}) {
  const repr = representativeSession(row)
  const dateLabel = repr?.sessionStartedAt
    ? new Date(repr.sessionStartedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null
  const primary = longitudinal && dateLabel ? dateLabel : row.participantName
  const secondary = longitudinal
    ? repr?.attemptNumber
      ? `Attempt ${repr.attemptNumber}`
      : null
    : dateLabel
  return (
    <span className="group inline-flex items-center gap-2 rounded-full border border-border bg-background pl-1 pr-1 py-1 shadow-sm">
      <Avatar size="sm" className="size-5">
        <AvatarFallback className="text-[9px] font-semibold">
          {getInitials(row.participantName, row.participantEmail)}
        </AvatarFallback>
      </Avatar>
      <span className="flex flex-col leading-tight pr-0.5">
        <span className="text-xs font-semibold">{primary}</span>
        {secondary && (
          <span className="text-[10px] text-muted-foreground">{secondary}</span>
        )}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${row.participantName}`}
        className="ml-0.5 inline-flex size-5 items-center justify-center rounded-full text-muted-foreground opacity-60 transition-opacity hover:bg-muted hover:opacity-100"
      >
        <X className="size-3" />
      </button>
    </span>
  )
}

function SegmentedToggle({
  label,
  items,
  active,
  onToggle,
}: {
  label: string
  items: { key: string; label: string; badge?: number }[]
  active: string[]
  onToggle: (key: string) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-overline text-muted-foreground">{label}</span>
      <div className="inline-flex items-center rounded-full border border-border bg-muted/40 p-0.5">
        {items.map((it) => {
          const isActive = active.includes(it.key)
          return (
            <button
              key={it.key}
              type="button"
              onClick={() => onToggle(it.key)}
              aria-pressed={isActive}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {it.label}
              {typeof it.badge === 'number' && (
                <span
                  className={cn(
                    'rounded-full px-1 text-[9px] tabular-nums',
                    isActive ? 'bg-primary/15 text-primary' : 'bg-foreground/10',
                  )}
                >
                  {it.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
