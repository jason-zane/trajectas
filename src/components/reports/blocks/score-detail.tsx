import type { ScoreDetailConfig, BandResult } from '@/lib/reports/types'
import type { PresentationMode, ChartType } from '@/lib/reports/presentation'
import { BandBadge } from '../charts/band-badge'
import { BarChart } from '../charts/bar-chart'
import { SegmentBar } from '../charts/segment-bar'
import { MiniBar } from '../charts/mini-bar'
import { ScorecardTable } from '../charts/scorecard-table'

function SectionLabel({ label, colour }: { label: string; colour: string }) {
  return (
    <p
      className="text-[9px] font-semibold uppercase tracking-wider mb-1.5"
      style={{ color: colour }}
    >
      {label}
    </p>
  )
}

interface ScoreDetailEntity {
  entityId: string
  entityName: string
  entitySlug: string
  definition?: string
  description?: string
  pompScore: number
  bandResult: BandResult
  narrative: string | null
  developmentSuggestion: string | null
  nestedScores?: ScoreDetailEntity[]
}

interface ScoreDetailData {
  entities?: ScoreDetailEntity[]
  config: ScoreDetailConfig
  // Legacy single-entity shape (backward compat)
  entityId?: string
  entityName?: string
  entitySlug?: string
  definition?: string
  description?: string
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

  const entities: ScoreDetailEntity[] = d.entities
    ? d.entities
    : d.entityId && d.bandResult
      ? [{
          entityId: d.entityId,
          entityName: d.entityName ?? '',
          entitySlug: d.entitySlug ?? '',
          definition: d.definition,
          description: d.description,
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

  // Carded mode: each entity as a card, nested children as sub-cards
  if (resolvedMode === 'carded') {
    return (
      <>
        {entities.map((entity) => (
          <CardedLayout key={entity.entityId} entity={entity} config={config} />
        ))}
      </>
    )
  }

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

/* ---------- Shared: nested children section ---------- */
function NestedSection({
  children,
  config,
  resolvedChart,
  variant = 'default',
}: {
  children: ScoreDetailEntity[]
  config: ScoreDetailConfig
  resolvedChart: string
  variant?: 'default' | 'featured'
}) {
  const label = config.nestedLabel || 'Factors'
  const isFeatured = variant === 'featured'

  return (
    <div
      className="mt-4 space-y-4 pl-5"
      style={{ borderLeft: `2px solid ${isFeatured ? 'rgba(255,255,255,0.2)' : 'var(--report-divider)'}` }}
    >
      <p
        className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: isFeatured ? 'rgba(255,255,255,0.5)' : 'var(--report-label-colour)' }}
      >
        {label}
      </p>
      {children.map((child) => (
        <OpenLayout
          key={child.entityId}
          entity={child}
          config={config}
          resolvedChart={resolvedChart}
          isChild
          variant={variant}
        />
      ))}
    </div>
  )
}

/* ---------- Open layout ---------- */
function OpenLayout({
  entity,
  config,
  resolvedChart,
  isChild,
  variant = 'default',
}: {
  entity: ScoreDetailEntity
  config: ScoreDetailConfig
  resolvedChart: string
  isChild?: boolean
  variant?: 'default' | 'featured'
}) {
  const isFeatured = variant === 'featured'
  const headingColour = isFeatured ? 'currentColor' : 'var(--report-heading-colour)'
  const bodyColour = isFeatured ? 'currentColor' : 'var(--report-body-colour)'
  const mutedColour = isFeatured ? 'rgba(255,255,255,0.6)' : 'var(--report-muted-colour)'

  return (
    <div className={`space-y-4 py-2 break-inside-avoid ${isChild ? '' : 'print:pt-[10mm] print:pb-[2mm]'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <h3
          className={isChild ? 'text-[15px] font-semibold' : 'text-lg font-semibold'}
          style={{ color: headingColour }}
        >
          {entity.entityName}
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          {config.showBandLabel && (
            <BandBadge band={entity.bandResult.band} label={entity.bandResult.bandLabel} />
          )}
          {config.showScore && (
            <span
              className={isChild ? 'text-xl font-bold tabular-nums' : 'text-2xl font-bold tabular-nums'}
              style={{ color: headingColour }}
            >
              {Math.round(entity.pompScore)}
            </span>
          )}
        </div>
      </div>

      {/* Score bar */}
      {resolvedChart === 'segment' ? (
        <SegmentBar value={entity.pompScore} band={entity.bandResult.band} />
      ) : (
        <BarChart
          items={[{ name: entity.entityName, value: entity.pompScore, band: entity.bandResult.band }]}
          variant={isFeatured ? 'dark' : 'light'}
        />
      )}

      {/* Definition */}
      {config.showDefinition && entity.definition && (
        <div>
          <SectionLabel label="Definition" colour={mutedColour} />
          <div
            className="prose prose-sm max-w-none text-sm italic"
            style={{ color: mutedColour, opacity: isFeatured ? 0.7 : 1 }}
            dangerouslySetInnerHTML={{ __html: entity.definition }}
          />
        </div>
      )}

      {/* Description */}
      {config.showDescription && entity.description && (
        <div>
          <SectionLabel label="Description" colour={mutedColour} />
          <div
            className="prose prose-sm max-w-none text-sm leading-relaxed"
            style={{ color: bodyColour, opacity: isFeatured ? 0.8 : 1 }}
            dangerouslySetInnerHTML={{ __html: entity.description }}
          />
        </div>
      )}

      {/* Behavioural Indicators */}
      {config.showIndicators && entity.narrative && (
        <div>
          <SectionLabel label="Behavioural Indicators" colour={mutedColour} />
          <div
            className="prose prose-sm max-w-none text-sm leading-relaxed"
            style={{ color: bodyColour, opacity: isFeatured ? 0.8 : 1 }}
            dangerouslySetInnerHTML={{ __html: entity.narrative }}
          />
        </div>
      )}

      {/* Development suggestion */}
      {config.showDevelopment && entity.developmentSuggestion && (
        <div
          className="rounded-lg border p-4"
          style={{
            borderColor: isFeatured ? 'rgba(255,255,255,0.15)' : 'var(--report-divider)',
            background: isFeatured ? 'rgba(255,255,255,0.05)' : 'var(--report-card-bg)',
          }}
        >
          <SectionLabel label="Development" colour={mutedColour} />
          <div
            className="prose prose-sm max-w-none text-sm"
            style={{ color: bodyColour, opacity: isFeatured ? 0.8 : 1 }}
            dangerouslySetInnerHTML={{ __html: entity.developmentSuggestion }}
          />
        </div>
      )}

      {/* Nested child entities */}
      {config.showNestedScores && entity.nestedScores && entity.nestedScores.length > 0 && (
        <NestedSection children={entity.nestedScores} config={config} resolvedChart={resolvedChart} variant={variant} />
      )}

      {/* Divider (parent level only, non-featured) */}
      {!isChild && !isFeatured && (
        <div className="pt-2" style={{ borderBottom: '1px solid var(--report-divider)' }} />
      )}
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
    <>
      <div
        className="border rounded-xl p-5 break-inside-avoid"
        style={{
          background: 'var(--report-card-bg)',
          borderColor: 'var(--report-card-border)',
        }}
      >
        <h3
          className="text-[15px] font-semibold mb-2"
          style={{ color: 'var(--report-heading-colour)' }}
        >
          {entity.entityName}
        </h3>

        {(config.showBandLabel || config.showScore) && (
          <div className="flex items-center gap-2 mb-3">
            {config.showBandLabel && (
              <BandBadge band={entity.bandResult.band} label={entity.bandResult.bandLabel} />
            )}
            {config.showScore && (
              <span
                className="text-lg font-bold tabular-nums"
                style={{ color: 'var(--report-heading-colour)' }}
              >
                {Math.round(entity.pompScore)}
              </span>
            )}
          </div>
        )}

        <MiniBar value={entity.pompScore} band={entity.bandResult.band} className="mb-3" />

        {entity.narrative && (
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--report-body-colour)' }}>
            {entity.narrative}
          </p>
        )}
      </div>

      {/* Nested children as their own cards */}
      {config.showNestedScores && entity.nestedScores && entity.nestedScores.length > 0 && (
        <>
          {entity.nestedScores.map((child) => (
            <div
              key={child.entityId}
              className="border rounded-xl p-5 break-inside-avoid ml-4"
              style={{
                background: 'var(--report-card-bg)',
                borderColor: 'var(--report-card-border)',
              }}
            >
              <h3
                className="text-[14px] font-semibold mb-2"
                style={{ color: 'var(--report-heading-colour)' }}
              >
                {child.entityName}
              </h3>

              {(config.showBandLabel || config.showScore) && (
                <div className="flex items-center gap-2 mb-3">
                  {config.showBandLabel && (
                    <BandBadge band={child.bandResult.band} label={child.bandResult.bandLabel} />
                  )}
                  {config.showScore && (
                    <span
                      className="text-base font-bold tabular-nums"
                      style={{ color: 'var(--report-heading-colour)' }}
                    >
                      {Math.round(child.pompScore)}
                    </span>
                  )}
                </div>
              )}

              <MiniBar value={child.pompScore} band={child.bandResult.band} className="mb-3" />

              {child.narrative && (
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--report-body-colour)' }}>
                  {child.narrative}
                </p>
              )}
            </div>
          ))}
        </>
      )}
    </>
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
      <h3 className="text-2xl font-semibold text-current">{entity.entityName}</h3>

      {config.showBandLabel && (
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--report-featured-accent)' }}
        >
          {entity.bandResult.bandLabel}
        </span>
      )}

      {config.showScore && (
        <span className="text-2xl font-bold tabular-nums text-current opacity-80">
          {Math.round(entity.pompScore)}
        </span>
      )}

      {resolvedChart === 'segment' ? (
        <SegmentBar value={entity.pompScore} band={entity.bandResult.band} />
      ) : (
        <BarChart
          items={[{ name: entity.entityName, value: entity.pompScore, band: entity.bandResult.band }]}
          variant="dark"
        />
      )}

      {config.showDefinition && entity.definition && (
        <p className="text-sm italic text-current opacity-60">
          {entity.definition}
        </p>
      )}

      {config.showDescription && entity.description && (
        <p className="text-sm leading-relaxed text-current opacity-80">
          {entity.description}
        </p>
      )}

      {config.showIndicators && entity.narrative && (
        <p className="text-sm leading-relaxed text-current opacity-80">
          {entity.narrative}
        </p>
      )}

      {/* Nested children in featured — uses OpenLayout with featured variant */}
      {config.showNestedScores && entity.nestedScores && entity.nestedScores.length > 0 && (
        <NestedSection children={entity.nestedScores} config={config} resolvedChart={resolvedChart} variant="featured" />
      )}
    </div>
  )
}
