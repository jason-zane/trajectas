import type { PresentationMode, ChartType } from '@/lib/reports/presentation'
import { GroupedBarChart } from '../charts/grouped-bar-chart'
import { RadarOverlayChart } from '../charts/radar-overlay-chart'

const RATER_LABELS: Record<string, string> = {
  self: 'Self',
  manager: 'Manager',
  peers: 'Peers',
  direct_reports: 'Direct Reports',
  overall: 'Overall',
}

const RATER_COLOURS: Record<string, string> = {
  self: 'var(--report-rater-self)',
  manager: 'var(--report-rater-manager)',
  peers: 'var(--report-rater-peers)',
  direct_reports: 'var(--report-rater-directs)',
  overall: 'var(--report-rater-overall)',
}

interface RaterEntry {
  entityName: string
  scores: Record<string, number>
}

interface RaterComparisonData {
  entries?: RaterEntry[]
  raterGroups: string[]
  _360?: boolean
}

export function RaterComparisonBlock({ data, mode, chartType }: { data: Record<string, unknown>; mode?: PresentationMode; chartType?: ChartType }) {
  const d = data as unknown as RaterComparisonData

  if (d._360 || !d.entries?.length) {
    return (
      <div
        className="rounded-lg border border-dashed p-6 text-center text-sm"
        style={{
          borderColor: 'var(--report-divider)',
          color: 'var(--report-muted-colour)',
        }}
      >
        Rater comparison data will appear here once 360 responses are collected and scored.
      </div>
    )
  }

  const entries = d.entries
  const resolvedMode = mode ?? 'open'
  const resolvedChart = chartType ?? 'grouped_bar'

  // Transform entries for chart components
  const chartItems = entries.map((entry) => ({
    name: entry.entityName,
    scores: d.raterGroups
      .filter((rg) => entry.scores[rg] !== undefined)
      .map((rg) => ({
        source: rg as 'self' | 'manager' | 'peers' | 'direct_reports' | 'overall',
        value: entry.scores[rg],
      })),
  }))

  // Carded: entity cards with compact rater score rows
  if (resolvedMode === 'carded') {
    return (
      <div>
        <div
          className="text-[10px] uppercase tracking-[2px] mb-5"
          style={{ color: 'var(--report-label-colour)' }}
        >
          Rater Comparison
        </div>
        <div className="space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.entityName}
              className="border rounded-xl p-5"
              style={{
                background: 'var(--report-card-bg)',
                borderColor: 'var(--report-card-border)',
              }}
            >
              <p
                className="text-[15px] font-semibold mb-3"
                style={{ color: 'var(--report-heading-colour)' }}
              >
                {entry.entityName}
              </p>
              <div className="space-y-2">
                {d.raterGroups.map((rg) => {
                  const score = entry.scores[rg]
                  if (score === undefined) return null
                  return (
                    <div key={rg} className="flex items-center gap-3">
                      <span
                        className="text-[11px] w-[80px] shrink-0"
                        style={{ color: 'var(--report-muted-colour)' }}
                      >
                        {RATER_LABELS[rg] ?? rg}
                      </span>
                      <div className="flex-1">
                        <div
                          className="h-[5px] rounded w-full"
                          style={{ background: 'var(--report-divider)' }}
                        >
                          <div
                            className="h-[5px] rounded"
                            style={{
                              width: `${score}%`,
                              background: RATER_COLOURS[rg] ?? 'var(--report-rater-overall)',
                            }}
                          />
                        </div>
                      </div>
                      <span
                        className="text-[11px] tabular-nums w-[28px] text-right"
                        style={{ color: 'var(--report-heading-colour)' }}
                      >
                        {Math.round(score)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Chart-based layouts (open / featured)
  if (resolvedChart === 'radar_360') {
    const labels = entries.map((e) => e.entityName)
    const layers = d.raterGroups.map((rg) => ({
      source: RATER_LABELS[rg] ?? rg,
      values: entries.map((e) => e.scores[rg] ?? 0),
      color: RATER_COLOURS[rg] ?? 'var(--report-rater-overall)',
    }))

    return (
      <div>
        <div
          className="text-[10px] uppercase tracking-[2px] mb-5"
          style={{ color: resolvedMode === 'featured' ? 'rgba(255,255,255,0.5)' : 'var(--report-label-colour)' }}
        >
          Rater Comparison
        </div>
        <RadarOverlayChart
          labels={labels}
          layers={layers}
          variant={resolvedMode === 'featured' ? 'dark' : 'light'}
        />
      </div>
    )
  }

  // Default: grouped bar
  return (
    <div>
      <div
        className="text-[10px] uppercase tracking-[2px] mb-5"
        style={{ color: resolvedMode === 'featured' ? 'rgba(255,255,255,0.5)' : 'var(--report-label-colour)' }}
      >
        Rater Comparison
      </div>
      <GroupedBarChart
        items={chartItems}
        visibleSources={d.raterGroups}
      />
    </div>
  )
}
