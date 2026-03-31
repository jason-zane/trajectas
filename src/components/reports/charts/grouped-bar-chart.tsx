'use client'

import { cn } from '@/lib/utils'

type RaterSource = 'self' | 'manager' | 'peers' | 'direct_reports' | 'overall'

interface GroupedBarChartProps {
  items: {
    name: string
    scores: { source: RaterSource; value: number }[]
  }[]
  visibleSources: string[]
  className?: string
}

const SOURCE_LABELS: Record<RaterSource, string> = {
  self: 'Self',
  manager: 'Manager',
  peers: 'Peers',
  direct_reports: 'Direct Reports',
  overall: 'Overall',
}

const SOURCE_COLOURS: Record<RaterSource, string> = {
  self: 'var(--report-rater-self)',
  manager: 'var(--report-rater-manager)',
  peers: 'var(--report-rater-peers)',
  direct_reports: 'var(--report-rater-directs)',
  overall: 'var(--report-rater-overall)',
}

const ALL_SOURCES: RaterSource[] = ['self', 'manager', 'peers', 'direct_reports', 'overall']

export function GroupedBarChart({ items, visibleSources, className }: GroupedBarChartProps) {
  const activeSources = ALL_SOURCES.filter((s) => visibleSources.includes(s))

  return (
    <div className={cn('w-full', className)}>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 pl-[152px]">
        {activeSources.map((source) => (
          <div key={source} className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: SOURCE_COLOURS[source] }}
            />
            <span className="text-[10px]" style={{ color: 'var(--report-muted-colour)' }}>
              {SOURCE_LABELS[source]}
            </span>
          </div>
        ))}
      </div>

      {/* Rows */}
      {items.map((item) => {
        const visibleScores = item.scores.filter((s) => visibleSources.includes(s.source))

        return (
          <div
            key={item.name}
            className="grid items-center mb-4"
            style={{ gridTemplateColumns: '140px 1fr', gap: '12px' }}
          >
            {/* Label */}
            <div
              className="text-[13px] font-medium text-right"
              style={{ color: 'var(--report-heading-colour)' }}
            >
              {item.name}
            </div>

            {/* Grouped bars */}
            <div className="flex flex-col gap-1">
              {visibleScores.map((score) => (
                <div key={score.source} className="flex items-center">
                  <div
                    className="h-[6px] rounded-full"
                    style={{
                      width: `${score.value}%`,
                      background: SOURCE_COLOURS[score.source as RaterSource] ?? 'var(--report-rater-overall)',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
