import type { ScoreDetailConfig, BandResult } from '@/lib/reports/types'
import type { PresentationMode, ChartType } from '@/lib/reports/presentation'
import { BandBadge } from '../charts/band-badge'
import { BarChart } from '../charts/bar-chart'
import { SegmentBar } from '../charts/segment-bar'
import { MiniBar } from '../charts/mini-bar'
import { ScorecardTable } from '../charts/scorecard-table'

interface ScoreDetailData {
  entityId: string
  entityName: string
  entitySlug: string
  definition?: string
  pompScore: number
  bandResult: BandResult
  narrative: string | null
  developmentSuggestion: string | null
  config: ScoreDetailConfig
  parentName?: string
  _empty?: boolean
}

export function ScoreDetailBlock({ data, mode, chartType }: { data: Record<string, unknown>; mode?: PresentationMode; chartType?: ChartType }) {
  const d = data as unknown as ScoreDetailData
  if (d._empty) return null

  const resolvedMode = mode ?? 'open'
  const resolvedChart = chartType ?? 'bar'
  const { config, bandResult } = d

  // Scorecard mode — only makes sense when called with multiple entities
  // but we still render a single-row table for consistency
  if (resolvedChart === 'scorecard') {
    return (
      <ScorecardTable
        items={[
          {
            name: d.entityName,
            parentName: d.parentName ?? '',
            value: d.pompScore,
            band: bandResult.band,
            bandLabel: bandResult.bandLabel,
          },
        ]}
      />
    )
  }

  if (resolvedMode === 'featured') {
    return <FeaturedLayout d={d} config={config} bandResult={bandResult} resolvedChart={resolvedChart} />
  }

  if (resolvedMode === 'carded') {
    return <CardedLayout d={d} config={config} bandResult={bandResult} />
  }

  // open (default)
  return <OpenLayout d={d} config={config} bandResult={bandResult} resolvedChart={resolvedChart} />
}

/* ---------- Open layout ---------- */
function OpenLayout({
  d,
  config,
  bandResult,
  resolvedChart,
}: {
  d: ScoreDetailData
  config: ScoreDetailConfig
  bandResult: BandResult
  resolvedChart: string
}) {
  return (
    <div className="space-y-4 py-2 break-inside-avoid">
      {/* Header: entity name + band badge */}
      <div className="flex items-start justify-between gap-4">
        <h3
          className="text-lg font-semibold"
          style={{ color: 'var(--report-heading-colour)' }}
        >
          {d.entityName}
        </h3>
        {config.showScore && (
          <div className="flex items-center gap-2 shrink-0">
            {config.showBandLabel && (
              <BandBadge band={bandResult.band} label={bandResult.bandLabel} />
            )}
            <span
              className="text-2xl font-bold tabular-nums"
              style={{ color: 'var(--report-heading-colour)' }}
            >
              {Math.round(d.pompScore)}
            </span>
          </div>
        )}
      </div>

      {/* Score visualisation */}
      {config.showScore && (
        resolvedChart === 'segment' ? (
          <SegmentBar value={d.pompScore} band={bandResult.band} />
        ) : (
          <BarChart
            items={[{ name: d.entityName, value: d.pompScore, band: bandResult.band }]}
          />
        )
      )}

      {/* Definition */}
      {config.showDefinition && d.definition && (
        <p className="text-sm italic" style={{ color: 'var(--report-muted-colour)' }}>
          {d.definition}
        </p>
      )}

      {/* Narrative */}
      {(config.showIndicators || config.showDefinition) && d.narrative && (
        <p className="text-sm leading-relaxed" style={{ color: 'var(--report-body-colour)' }}>
          {d.narrative}
        </p>
      )}

      {/* Development suggestion */}
      {config.showDevelopment && d.developmentSuggestion && (
        <div
          className="rounded-lg border p-4"
          style={{
            borderColor: 'var(--report-divider)',
            background: 'var(--report-card-bg)',
          }}
        >
          <p
            className="text-xs font-medium mb-1 uppercase tracking-wide"
            style={{ color: 'var(--report-label-colour)' }}
          >
            Development
          </p>
          <p className="text-sm" style={{ color: 'var(--report-body-colour)' }}>
            {d.developmentSuggestion}
          </p>
        </div>
      )}

      {/* Divider at bottom for open-mode stacking */}
      <div className="pt-2" style={{ borderBottom: '1px solid var(--report-divider)' }} />
    </div>
  )
}

/* ---------- Carded layout ---------- */
function CardedLayout({
  d,
  config,
  bandResult,
}: {
  d: ScoreDetailData
  config: ScoreDetailConfig
  bandResult: BandResult
}) {
  return (
    <div
      className="border rounded-xl p-5 break-inside-avoid"
      style={{
        background: 'var(--report-card-bg)',
        borderColor: 'var(--report-card-border)',
      }}
    >
      {/* Name */}
      <h3
        className="text-[15px] font-semibold mb-2"
        style={{ color: 'var(--report-heading-colour)' }}
      >
        {d.entityName}
      </h3>

      {/* Band badge + score row */}
      {config.showScore && (
        <div className="flex items-center gap-2 mb-3">
          {config.showBandLabel && (
            <BandBadge band={bandResult.band} label={bandResult.bandLabel} />
          )}
          <span
            className="text-lg font-bold tabular-nums"
            style={{ color: 'var(--report-heading-colour)' }}
          >
            {Math.round(d.pompScore)}
          </span>
        </div>
      )}

      {/* Mini bar */}
      {config.showScore && (
        <MiniBar value={d.pompScore} band={bandResult.band} className="mb-3" />
      )}

      {/* Short narrative */}
      {d.narrative && (
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--report-body-colour)' }}>
          {d.narrative}
        </p>
      )}
    </div>
  )
}

/* ---------- Featured layout ---------- */
function FeaturedLayout({
  d,
  config,
  bandResult,
  resolvedChart,
}: {
  d: ScoreDetailData
  config: ScoreDetailConfig
  bandResult: BandResult
  resolvedChart: string
}) {
  return (
    <div className="space-y-4 break-inside-avoid">
      {/* Large heading */}
      <h3 className="text-2xl font-semibold text-current">{d.entityName}</h3>

      {/* Band label in accent colour */}
      {config.showBandLabel && (
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--report-featured-accent)' }}
        >
          {bandResult.bandLabel}
        </span>
      )}

      {/* Score bar */}
      {config.showScore && (
        resolvedChart === 'segment' ? (
          <SegmentBar value={d.pompScore} band={bandResult.band} />
        ) : (
          <BarChart
            items={[{ name: d.entityName, value: d.pompScore, band: bandResult.band }]}
            variant="dark"
          />
        )
      )}

      {/* Narrative */}
      {d.narrative && (
        <p className="text-sm leading-relaxed text-current opacity-80">
          {d.narrative}
        </p>
      )}
    </div>
  )
}
