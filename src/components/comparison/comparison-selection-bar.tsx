'use client'
import { Button } from '@/components/ui/button'
import { ComparisonExportButton } from './comparison-export-button'
import type {
  ComparisonRequest,
  ComparisonRow,
  Granularity,
} from '@/lib/comparison/types'
import type { EligibleAssessment } from '@/app/actions/comparison'

export function ComparisonSelectionBar({
  rows,
  request,
  campaignSlug,
  eligibleAssessments,
  onRemoveEntry,
  onAddEntryClick,
  onToggleAssessment,
  onChangeGranularity,
}: {
  rows: ComparisonRow[]
  request: ComparisonRequest
  campaignSlug?: string
  eligibleAssessments: EligibleAssessment[]
  onRemoveEntry: (entryId: string) => void
  onAddEntryClick: () => void
  onToggleAssessment: (assessmentId: string) => void
  onChangeGranularity: (g: Granularity) => void
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
        <div className="inline-flex rounded-md border border-border overflow-hidden text-xs">
          <button
            type="button"
            className={`px-2 py-1 ${
              request.granularity === 'dimensions' ? 'bg-primary text-primary-foreground' : ''
            }`}
            onClick={() => onChangeGranularity('dimensions')}
          >
            Dimensions
          </button>
          <button
            type="button"
            className={`px-2 py-1 ${
              request.granularity === 'factors_or_constructs'
                ? 'bg-primary text-primary-foreground'
                : ''
            }`}
            onClick={() => onChangeGranularity('factors_or_constructs')}
          >
            Factors / Constructs
          </button>
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
