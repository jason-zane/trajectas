import type { PresentationMode, ChartType } from '@/lib/reports/presentation'
import { GapIndicator } from '../charts/gap-indicator'

interface GapItem {
  entityName: string
  selfScore: number
  othersScore: number
  gap: number
  type: 'blind_spot' | 'hidden_strength'
}

interface GapAnalysisData {
  blindSpots?: GapItem[]
  hiddenStrengths?: GapItem[]
  _360?: boolean
}

export function GapAnalysisBlock({ data, mode }: { data: Record<string, unknown>; mode?: PresentationMode; chartType?: ChartType }) {
  const d = data as GapAnalysisData

  if (d._360 || (!d.blindSpots?.length && !d.hiddenStrengths?.length)) {
    return (
      <div
        className="rounded-lg border border-dashed p-6 text-center text-sm"
        style={{
          borderColor: 'var(--report-divider)',
          color: 'var(--report-muted-colour)',
        }}
      >
        Gap analysis will appear here once 360 responses are collected and scored.
      </div>
    )
  }

  const resolvedMode = mode ?? 'open'
  const isFeatured = resolvedMode === 'featured'

  // Transform blind spots + hidden strengths into GapIndicator items
  const allItems = [
    ...(d.blindSpots ?? []).map((item) => ({
      name: item.entityName,
      selfScore: item.selfScore,
      othersScore: item.othersScore,
      gapType: 'blind_spot' as const,
    })),
    ...(d.hiddenStrengths ?? []).map((item) => ({
      name: item.entityName,
      selfScore: item.selfScore,
      othersScore: item.othersScore,
      gapType: 'hidden_strength' as const,
    })),
  ]

  return (
    <div>
      {/* Section headers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        {d.blindSpots && d.blindSpots.length > 0 && (
          <div>
            <h4
              className="text-sm font-semibold"
              style={{ color: isFeatured ? 'var(--report-featured-accent)' : 'var(--report-low-band-fill)' }}
            >
              Potential Blind Spots
            </h4>
            <p
              className="text-xs mt-0.5"
              style={{ color: isFeatured ? 'rgba(255,255,255,0.5)' : 'var(--report-muted-colour)' }}
            >
              Areas where self-rating exceeds others&apos; ratings
            </p>
          </div>
        )}
        {d.hiddenStrengths && d.hiddenStrengths.length > 0 && (
          <div>
            <h4
              className="text-sm font-semibold"
              style={{ color: isFeatured ? 'var(--report-featured-accent)' : 'var(--report-high-band-fill)' }}
            >
              Hidden Strengths
            </h4>
            <p
              className="text-xs mt-0.5"
              style={{ color: isFeatured ? 'rgba(255,255,255,0.5)' : 'var(--report-muted-colour)' }}
            >
              Areas where others rate higher than self-rating
            </p>
          </div>
        )}
      </div>

      {/* Gap indicator chart */}
      <GapIndicator items={allItems} />
    </div>
  )
}
