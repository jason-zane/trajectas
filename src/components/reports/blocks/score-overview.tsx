import type { ScoreOverviewConfig, BandResult } from '@/lib/reports/types'
import type { PresentationMode, ChartType } from '@/lib/reports/presentation'
import type { PaletteKey } from '@/lib/reports/band-scheme'
import { BarChart } from '../charts/bar-chart'
import { RadarChart } from '../charts/radar-chart'
import { GaugeChart } from '../charts/gauge-chart'
import { ScorecardTable } from '../charts/scorecard-table'

interface ScoreEntry {
  entityId: string
  entityName: string
  pompScore: number
  bandResult: BandResult
  parentName?: string
  anchorLow?: string
  anchorHigh?: string
}

interface ScoreOverviewData {
  scores: ScoreEntry[]
  config: ScoreOverviewConfig
  palette: PaletteKey
}

export function ScoreOverviewBlock({ data, mode, chartType }: { data: Record<string, unknown>; mode?: PresentationMode; chartType?: ChartType }) {
  const d = data as unknown as ScoreOverviewData
  if (!d.scores?.length) return null

  const isFeatured = mode === 'featured'
  const resolvedChart = chartType ?? 'bar'
  const showScore = d.config?.showScore !== false
  const showBandLabel = d.config?.showBandLabel !== false
  const showAnchors = d.config?.showAnchors === true
  const grouped = d.config?.groupByDimension === true
  const palette = d.palette

  const groups = grouped
    ? groupByParent(d.scores)
    : [{ parentName: null, scores: d.scores }]

  return (
    <div>
      {resolvedChart === 'radar' && (
        <RadarChart
          items={d.scores.map((s) => ({ name: s.entityName, value: s.pompScore, bandLabel: s.bandResult.bandLabel }))}
          variant={isFeatured ? 'dark' : 'light'}
          showScore={showScore}
          showBandLabel={showBandLabel}
        />
      )}

      {resolvedChart === 'gauges' && (
        <div className={grouped ? 'space-y-6' : undefined}>
          {groups.map((group, gi) => (
            <div key={gi}>
              {group.parentName && (
                <GroupHeading name={group.parentName} isFeatured={isFeatured} />
              )}
              <GaugeChart
                items={group.scores.map((s) => ({
                  name: s.entityName,
                  value: s.pompScore,
                  bandIndex: s.bandResult.bandIndex,
                  bandCount: s.bandResult.bandCount,
                  bandLabel: s.bandResult.bandLabel,
                }))}
                palette={palette}
                showScore={showScore}
                showBandLabel={showBandLabel}
                variant={isFeatured ? 'dark' : 'light'}
              />
              {showAnchors && <AnchorList scores={group.scores} isFeatured={isFeatured} />}
            </div>
          ))}
        </div>
      )}

      {resolvedChart === 'bar' && (
        <div className={grouped ? 'space-y-6' : undefined}>
          {groups.map((group, gi) => (
            <div key={gi}>
              {group.parentName && (
                <GroupHeading name={group.parentName} isFeatured={isFeatured} />
              )}
              <BarChart
                items={group.scores.map((s) => ({
                  name: s.entityName,
                  value: s.pompScore,
                  bandIndex: s.bandResult.bandIndex,
                  bandCount: s.bandResult.bandCount,
                  bandLabel: s.bandResult.bandLabel,
                }))}
                palette={palette}
                showBandLabels={showBandLabel}
                showScore={showScore}
                variant={isFeatured ? 'dark' : 'light'}
              />
              {showAnchors && <AnchorList scores={group.scores} isFeatured={isFeatured} />}
            </div>
          ))}
        </div>
      )}

      {resolvedChart === 'scorecard' && (
        <ScorecardTable
          items={d.scores.map((s) => ({
            name: s.entityName,
            parentName: s.parentName ?? '',
            value: s.pompScore,
            bandIndex: s.bandResult.bandIndex,
            bandCount: s.bandResult.bandCount,
            bandLabel: s.bandResult.bandLabel,
          }))}
          palette={palette}
        />
      )}
    </div>
  )
}

function GroupHeading({ name, isFeatured }: { name: string; isFeatured: boolean }) {
  return (
    <p
      className="text-[11px] font-semibold uppercase tracking-wider mb-3"
      style={{ color: isFeatured ? 'rgba(255,255,255,0.6)' : 'var(--report-label-colour)' }}
    >
      {name}
    </p>
  )
}

function AnchorList({ scores, isFeatured }: { scores: ScoreEntry[]; isFeatured: boolean }) {
  const hasAny = scores.some((s) => s.anchorLow || s.anchorHigh)
  if (!hasAny) return null
  const colour = isFeatured ? 'rgba(255,255,255,0.5)' : 'var(--report-muted-colour)'
  return (
    <div className="mt-3 space-y-1">
      {scores.map((s) => (s.anchorLow || s.anchorHigh) && (
        <div key={s.entityId} className="flex gap-2 text-[9px]" style={{ color: colour }}>
          <span className="font-medium shrink-0 w-28 truncate">{s.entityName}</span>
          <span className="flex-1">{s.anchorLow ?? ''}</span>
          <span className="flex-1 text-right">{s.anchorHigh ?? ''}</span>
        </div>
      ))}
    </div>
  )
}

function groupByParent(scores: ScoreEntry[]): { parentName: string | null; scores: ScoreEntry[] }[] {
  const map = new Map<string, ScoreEntry[]>()
  const ungrouped: ScoreEntry[] = []

  for (const s of scores) {
    if (s.parentName) {
      const list = map.get(s.parentName) ?? []
      list.push(s)
      map.set(s.parentName, list)
    } else {
      ungrouped.push(s)
    }
  }

  const groups: { parentName: string | null; scores: ScoreEntry[] }[] = []
  for (const [parentName, entries] of map) {
    groups.push({ parentName, scores: entries })
  }
  if (ungrouped.length > 0) {
    groups.push({ parentName: null, scores: ungrouped })
  }
  return groups
}
