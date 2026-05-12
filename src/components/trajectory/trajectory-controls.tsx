'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type {
  TrajectoryAssessmentRef,
  TrajectoryLevel,
} from '@/lib/trajectory/types'
import { TRAJECTORY_LEVELS } from '@/lib/trajectory/types'

const LEVEL_LABELS: Record<TrajectoryLevel, string> = {
  dimension: 'Dimension',
  factor: 'Factor',
  construct: 'Construct',
}

export function TrajectoryControls({
  level,
  onLevelChange,
  assessments,
  selectedAssessmentIds,
  onAssessmentsChange,
  view,
  onViewChange,
}: {
  level: TrajectoryLevel
  onLevelChange: (l: TrajectoryLevel) => void
  assessments: TrajectoryAssessmentRef[]
  selectedAssessmentIds: string[]
  onAssessmentsChange: (ids: string[]) => void
  view: 'charts' | 'matrix'
  onViewChange: (v: 'charts' | 'matrix') => void
}) {
  const allSelected =
    assessments.length > 0 && selectedAssessmentIds.length === assessments.length
  const toggleAssessment = (id: string) => {
    if (selectedAssessmentIds.includes(id)) {
      onAssessmentsChange(selectedAssessmentIds.filter((x) => x !== id))
    } else {
      onAssessmentsChange([...selectedAssessmentIds, id])
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-widest text-muted-foreground mr-1">
          Level
        </span>
        {TRAJECTORY_LEVELS.map((l) => (
          <Button
            key={l}
            variant={level === l ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => onLevelChange(l)}
          >
            {LEVEL_LABELS[l]}
          </Button>
        ))}

        <span className="text-xs uppercase tracking-widest text-muted-foreground ml-4 mr-1">
          View
        </span>
        <Button
          variant={view === 'charts' ? 'default' : 'outline'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => onViewChange('charts')}
        >
          Charts
        </Button>
        <Button
          variant={view === 'matrix' ? 'default' : 'outline'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => onViewChange('matrix')}
        >
          Matrix
        </Button>
      </div>

      {assessments.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs uppercase tracking-widest text-muted-foreground mr-1">
            Assessments
          </span>
          <Button
            variant={allSelected ? 'default' : 'outline'}
            size="sm"
            className="h-6 text-[11px]"
            onClick={() =>
              onAssessmentsChange(
                allSelected ? [] : assessments.map((a) => a.assessmentId),
              )
            }
          >
            {allSelected ? 'All' : 'All'}
          </Button>
          {assessments.map((a) => {
            const active = selectedAssessmentIds.includes(a.assessmentId)
            return (
              <button
                key={a.assessmentId}
                type="button"
                onClick={() => toggleAssessment(a.assessmentId)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] transition-colors',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card hover:bg-muted',
                )}
              >
                {a.assessmentName}
                <span className="opacity-70">({a.sessionCount})</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
