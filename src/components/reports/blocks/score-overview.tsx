import type { ScoreOverviewConfig, BandResult } from '@/lib/reports/types'
import type { PresentationMode, ChartType, ReportDepth } from '@/lib/reports/presentation'
import { getBandColour, type PaletteKey, type BandDefinition } from '@/lib/reports/band-scheme'
import { FactorRow } from '../factor-row'
import { RadarChart } from '../charts/radar-chart'
import { GaugeChart } from '../charts/gauge-chart'
import { ScorecardTable } from '../charts/scorecard-table'

interface ScoreEntry {
  entityId: string
  entityName: string
  pompScore: number
  bandResult: BandResult
  parentName?: string
  description?: string | null
  anchorLow?: string
  anchorHigh?: string
}

interface ParentScore {
  name: string
  pompScore: number
  bandResult: BandResult
}

interface ScoreOverviewData {
  scores: ScoreEntry[]
  config: ScoreOverviewConfig
  palette: PaletteKey
  /** Dimension scores for group headers (newer snapshots only). */
  parents?: ParentScore[]
  /** Band definitions for boundary ticks (newer snapshots only). */
  bands?: BandDefinition[]
}

export function ScoreOverviewBlock({ data, mode, chartType }: { data: Record<string, unknown>; mode?: PresentationMode; chartType?: ChartType }) {
  const d = data as unknown as ScoreOverviewData
  if (!d.scores?.length) return null

  const isFeatured = mode === 'featured'
  const resolvedChart = chartType ?? 'bar'
  const showScore = d.config?.showScore !== false
  const showBandLabel = d.config?.showBandLabel !== false
  const grouped = d.config?.groupByDimension === true
  const palette = d.palette
  // Depth presets supersede the legacy showAnchors toggle but honour it for
  // templates saved before depth existed.
  const depth: ReportDepth = d.config?.depth ?? (d.config?.showAnchors === true ? 'rich' : 'glance')

  const groups = grouped
    ? groupByParent(d.scores)
    : [{ parentName: null, scores: d.scores }]

  const parentByName = new Map<string, ParentScore>()
  for (const p of d.parents ?? []) parentByName.set(p.name, p)

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
                <GroupHeader
                  name={group.parentName}
                  parent={parentByName.get(group.parentName)}
                  palette={palette}
                  isFeatured={isFeatured}
                />
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
            </div>
          ))}
        </div>
      )}

      {resolvedChart === 'bar' && (
        <div className={grouped ? 'space-y-5' : undefined}>
          {groups.map((group, gi) => (
            <div key={gi} className="report-group">
              {group.parentName && (
                <GroupHeader
                  name={group.parentName}
                  parent={parentByName.get(group.parentName)}
                  palette={palette}
                  isFeatured={isFeatured}
                />
              )}
              {group.scores.map((s) => (
                <FactorRow
                  key={s.entityId}
                  name={s.entityName}
                  pompScore={s.pompScore}
                  bandResult={s.bandResult}
                  palette={palette}
                  bands={d.bands}
                  depth={depth}
                  description={s.description}
                  anchorLow={s.anchorLow}
                  anchorHigh={s.anchorHigh}
                  showScore={showScore}
                  showBandLabel={showBandLabel}
                  variant={isFeatured ? 'dark' : 'light'}
                  size={depth === 'glance' ? 'compact' : 'default'}
                />
              ))}
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

function GroupHeader({
  name,
  parent,
  palette,
  isFeatured,
}: {
  name: string
  parent?: ParentScore
  palette: PaletteKey
  isFeatured: boolean
}) {
  return (
    <div
      className="mb-2 flex items-baseline justify-between gap-3 border-b pb-1.5"
      style={{
        borderColor: isFeatured ? 'rgba(255,255,255,0.2)' : 'var(--report-divider)',
        breakAfter: 'avoid',
      }}
    >
      <span
        className="font-mono text-[10px] font-medium uppercase tracking-[0.18em]"
        style={{ color: isFeatured ? 'rgba(255,255,255,0.6)' : 'var(--report-label-colour)' }}
      >
        {name}
      </span>
      {parent && (
        <span className="flex items-center gap-1.5">
          <span
            className="size-1.5 rounded-full"
            style={{ background: getBandColour(palette, parent.bandResult.bandIndex, parent.bandResult.bandCount) }}
          />
          <span
            className="font-mono text-[11.5px] font-semibold tabular-nums"
            style={{ color: isFeatured ? 'rgba(255,255,255,0.85)' : 'var(--report-heading-colour)' }}
          >
            {Math.round(parent.pompScore)}
          </span>
        </span>
      )}
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
