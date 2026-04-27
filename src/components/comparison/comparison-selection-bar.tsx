'use client'
import { Button } from '@/components/ui/button'
import { ComparisonExportButton } from './comparison-export-button'
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
  onRemoveEntry,
  onAddEntryClick,
  onToggleAssessment,
  onToggleLevel,
}: {
  rows: ComparisonRow[]
  request: ComparisonRequest
  visibleLevels: ColumnLevel[]
  campaignSlug?: string
  eligibleAssessments: EligibleAssessment[]
  onRemoveEntry: (entryId: string) => void
  onAddEntryClick: () => void
  onToggleAssessment: (assessmentId: string) => void
  onToggleLevel: (level: ColumnLevel) => void
}) {
  const isEmpty = request.entries.length === 0
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-border bg-background/90 backdrop-blur px-4 py-3">
      <div className="flex flex-wrap gap-1.5 items-center min-w-0">
        {rows.map((r) => (
          <span
            key={r.entryId}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs"
          >
            <span className="font-medium">{r.participantName}</span>
            <button
              type="button"
              className="opacity-60 hover:opacity-100"
              onClick={() => onRemoveEntry(r.entryId)}
              aria-label={`Remove ${r.participantName}`}
            >
              ×
            </button>
          </span>
        ))}
        <Button variant="outline" size="sm" onClick={onAddEntryClick}>
          + Add participant
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5 items-center">
        {eligibleAssessments.map((a) => {
          const active = request.assessmentIds.includes(a.assessmentId)
          return (
            <button
              key={a.assessmentId}
              type="button"
              onClick={() => onToggleAssessment(a.assessmentId)}
              className={`text-xs rounded-full border px-2.5 py-1 ${
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border bg-muted'
              }`}
            >
              {a.assessmentName}
              <span className="ml-1 opacity-70">({a.completedSessionCount})</span>
            </button>
          )
        })}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center gap-1 text-xs">
          <span className="opacity-60 mr-1">Show:</span>
          {(['dimension', 'factor', 'construct'] as ColumnLevel[]).map((level) => {
            const active = visibleLevels.includes(level)
            return (
              <button
                key={level}
                type="button"
                onClick={() => onToggleLevel(level)}
                aria-pressed={active}
                className={`rounded-full border px-2.5 py-1 transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border bg-muted opacity-70 hover:opacity-100'
                }`}
              >
                {LEVEL_LABEL[level]}
              </button>
            )
          })}
        </div>
        <ComparisonExportButton
          request={request}
          campaignSlug={campaignSlug}
          disabled={isEmpty}
        />
      </div>
    </div>
  )
}
