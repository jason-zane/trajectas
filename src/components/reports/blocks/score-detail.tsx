import type { ScoreDetailConfig, BandResult } from '@/lib/reports/types'
import type { PresentationMode, ChartType } from '@/lib/reports/presentation'
import { BandBadge } from '../charts/band-badge'
import { BarChart } from '../charts/bar-chart'
import { SegmentBar } from '../charts/segment-bar'
import { MiniBar } from '../charts/mini-bar'
import { ScorecardTable } from '../charts/scorecard-table'

interface ScoreDetailEntity {
  entityId: string
  entityName: string
  entitySlug: string
  definition?: string
  pompScore: number
  bandResult: BandResult
  narrative: string | null
  developmentSuggestion: string | null
}

interface ScoreDetailData {
  // New multi-entity shape
  entities?: ScoreDetailEntity[]
  config: ScoreDetailConfig
  // Legacy single-entity shape (backward compat)
  entityId?: string
  entityName?: string
  entitySlug?: string
  definition?: string
  pompScore?: number
  bandResult?: BandResult
  narrative?: string | null
  developmentSuggestion?: string | null
  parentName?: string
  _empty?: boolean
}

export function ScoreDetailBlock({ data, mode, chartType }: { data: Record<string, unknown>; mode?: PresentationMode; chartType?: ChartType }) {
  const d = data as unknown as ScoreDetailData
  if (d._empty) return null

  // Normalise: legacy single-entity → array
  const entities: ScoreDetailEntity[] = d.entities
    ? d.entities
    : d.entityId && d.bandResult
      ? [{
          entityId: d.entityId,
          entityName: d.entityName ?? '',
          entitySlug: d.entitySlug ?? '',
          definition: d.definition,
          pompScore: d.pompScore ?? 0,
          bandResult: d.bandResult,
          narrative: d.narrative ?? null,
          developmentSuggestion: d.developmentSuggestion ?? null,
        }]
      : []

  if (entities.length === 0) return null

  const resolvedMode = mode ?? 'open'
  const resolvedChart = chartType ?? 'segment'
  const { config } = d

  // Scorecard mode — renders all entities in a single table
  if (resolvedChart === 'scorecard') {
    return (
      <ScorecardTable
        items={entities.map((entity) => ({
          name: entity.entityName,
          parentName: d.parentName ?? '',
          value: entity.pompScore,
          band: entity.bandResult.band,
          bandLabel: entity.bandResult.bandLabel,
        }))}
      />
    )
  }

  // Carded mode: render as fragment so items are direct grid children of CardedMode
  if (resolvedMode === 'carded') {
    return (
      <>
        {entities.map((entity) => (
          <CardedLayout key={entity.entityId} entity={entity} config={config} />
        ))}
      </>
    )
  }

  // Other modes: wrapped in a spacer div
  return (
    <div className="space-y-6">
      {entities.map((entity) => {
        if (resolvedMode === 'featured') {
          return <FeaturedLayout key={entity.entityId} entity={entity} config={config} resolvedChart={resolvedChart} />
        }
        return <OpenLayout key={entity.entityId} entity={entity} config={config} resolvedChart={resolvedChart} />
      })}
    </div>
  )
}

/* ---------- Open layout ---------- */
function OpenLayout({
  entity,
  config,
  resolvedChart,
}: {
  entity: ScoreDetailEntity
  config: ScoreDetailConfig
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
          {entity.entityName}
        </h3>
        {config.showScore && (
          <div className="flex items-center gap-2 shrink-0">
            {config.showBandLabel && (
              <BandBadge band={entity.bandResult.band} label={entity.bandResult.bandLabel} />
            )}
            <span
              className="text-2xl font-bold tabular-nums"
              style={{ color: 'var(--report-heading-colour)' }}
            >
              {Math.round(entity.pompScore)}
            </span>
          </div>
        )}
      </div>

      {/* Score visualisation */}
      {config.showScore && (
        resolvedChart === 'segment' ? (
          <SegmentBar value={entity.pompScore} band={entity.bandResult.band} />
        ) : (
          <BarChart
            items={[{ name: entity.entityName, value: entity.pompScore, band: entity.bandResult.band }]}
          />
        )
      )}

      {/* Definition */}
      {config.showDefinition && entity.definition && (
        <p className="text-sm italic" style={{ color: 'var(--report-muted-colour)' }}>
          {entity.definition}
        </p>
      )}

      {/* Narrative */}
      {(config.showIndicators || config.showDefinition) && entity.narrative && (
        <p className="text-sm leading-relaxed" style={{ color: 'var(--report-body-colour)' }}>
          {entity.narrative}
        </p>
      )}

      {/* Development suggestion */}
      {config.showDevelopment && entity.developmentSuggestion && (
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
            {entity.developmentSuggestion}
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
  entity,
  config,
}: {
  entity: ScoreDetailEntity
  config: ScoreDetailConfig
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
        {entity.entityName}
      </h3>

      {/* Band badge + score row */}
      {config.showScore && (
        <div className="flex items-center gap-2 mb-3">
          {config.showBandLabel && (
            <BandBadge band={entity.bandResult.band} label={entity.bandResult.bandLabel} />
          )}
          <span
            className="text-lg font-bold tabular-nums"
            style={{ color: 'var(--report-heading-colour)' }}
          >
            {Math.round(entity.pompScore)}
          </span>
        </div>
      )}

      {/* Mini bar */}
      {config.showScore && (
        <MiniBar value={entity.pompScore} band={entity.bandResult.band} className="mb-3" />
      )}

      {/* Short narrative */}
      {entity.narrative && (
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--report-body-colour)' }}>
          {entity.narrative}
        </p>
      )}
    </div>
  )
}

/* ---------- Featured layout ---------- */
function FeaturedLayout({
  entity,
  config,
  resolvedChart,
}: {
  entity: ScoreDetailEntity
  config: ScoreDetailConfig
  resolvedChart: string
}) {
  return (
    <div className="space-y-4 break-inside-avoid">
      {/* Large heading */}
      <h3 className="text-2xl font-semibold text-current">{entity.entityName}</h3>

      {/* Band label in accent colour */}
      {config.showBandLabel && (
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--report-featured-accent)' }}
        >
          {entity.bandResult.bandLabel}
        </span>
      )}

      {/* Score bar */}
      {config.showScore && (
        resolvedChart === 'segment' ? (
          <SegmentBar value={entity.pompScore} band={entity.bandResult.band} />
        ) : (
          <BarChart
            items={[{ name: entity.entityName, value: entity.pompScore, band: entity.bandResult.band }]}
            variant="dark"
          />
        )
      )}

      {/* Narrative */}
      {entity.narrative && (
        <p className="text-sm leading-relaxed text-current opacity-80">
          {entity.narrative}
        </p>
      )}
    </div>
  )
}
