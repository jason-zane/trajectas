import type { ScoreOverviewConfig, BandResult } from '@/lib/reports/types'
import type { PresentationMode, ChartType } from '@/lib/reports/presentation'
import { BarChart } from '../charts/bar-chart'
import { RadarChart } from '../charts/radar-chart'
import { GaugeChart } from '../charts/gauge-chart'
import { ScorecardTable } from '../charts/scorecard-table'

interface ScoreEntry {
  entityId: string
  entityName: string
  pompScore: number
  bandResult: BandResult
}

interface ScoreOverviewData {
  scores: ScoreEntry[]
  config: ScoreOverviewConfig
}

export function ScoreOverviewBlock({ data, mode, chartType }: { data: Record<string, unknown>; mode?: PresentationMode; chartType?: ChartType }) {
  const d = data as unknown as ScoreOverviewData
  if (!d.scores?.length) return null

  const isFeatured = mode === 'featured'
  const resolvedChart = chartType ?? 'bar'

  return (
    <div>
      <div
        className="text-[10px] uppercase tracking-[2px] mb-5"
        style={{ color: isFeatured ? 'rgba(255,255,255,0.5)' : 'var(--report-label-colour)' }}
      >
        Score Overview
      </div>

      {resolvedChart === 'radar' && (
        <RadarChart
          items={d.scores.map((s) => ({ name: s.entityName, value: s.pompScore, bandLabel: s.bandResult.bandLabel }))}
          variant={isFeatured ? 'dark' : 'light'}
          showScore={d.config?.showScore !== false}
          showBandLabel={d.config?.showBandLabel !== false}
        />
      )}

      {resolvedChart === 'gauges' && (
        <GaugeChart
          items={d.scores.map((s) => ({
            name: s.entityName,
            value: s.pompScore,
            band: s.bandResult.band,
            bandLabel: s.bandResult.bandLabel,
          }))}
          showScore={d.config?.showScore !== false}
          showBandLabel={d.config?.showBandLabel !== false}
        />
      )}

      {resolvedChart === 'bar' && (
        <BarChart
          items={d.scores.map((s) => ({
            name: s.entityName,
            value: s.pompScore,
            band: s.bandResult.band,
            bandLabel: s.bandResult.bandLabel,
          }))}
          showBandLabels={d.config?.showBandLabel !== false}
          showScore={d.config?.showScore !== false}
          variant={isFeatured ? 'dark' : 'light'}
        />
      )}

      {resolvedChart === 'scorecard' && (
        <ScorecardTable
          items={d.scores.map((s) => ({
            name: s.entityName,
            parentName: '',
            value: s.pompScore,
            band: s.bandResult.band,
            bandLabel: s.bandResult.bandLabel,
          }))}
        />
      )}
    </div>
  )
}
