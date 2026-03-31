import type { ScoreDetailConfig, BandResult, Band } from '@/lib/reports/types'

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
  _empty?: boolean
}

const BAND_STYLES: Record<Band, string> = {
  low: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  mid: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  high: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
}

export function ScoreDetailBlock({ data }: { data: Record<string, unknown> }) {
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

  const { config } = d

  return (
    <div className="space-y-6">
      {entities.map((entity) => (
        <div key={entity.entityId} className="space-y-4 py-2 break-inside-avoid">
          {/* Header: entity name + score */}
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-lg font-semibold">{entity.entityName}</h3>
            {config.showScore && (
              <div className="flex items-center gap-2 shrink-0">
                {config.showBandLabel && (
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${BAND_STYLES[entity.bandResult.band]}`}
                  >
                    {entity.bandResult.bandLabel}
                  </span>
                )}
                <span className="text-2xl font-bold tabular-nums text-primary">
                  {Math.round(entity.pompScore)}
                </span>
              </div>
            )}
          </div>

          {/* Score bar */}
          {config.showScore && (
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${entity.pompScore}%` }}
              />
            </div>
          )}

          {/* Definition */}
          {config.showDefinition && entity.definition && (
            <p className="text-sm text-muted-foreground italic">{entity.definition}</p>
          )}

          {/* Narrative */}
          {(config.showIndicators || config.showDefinition) && entity.narrative && (
            <p className="text-sm leading-relaxed">{entity.narrative}</p>
          )}

          {/* Development suggestion */}
          {config.showDevelopment && entity.developmentSuggestion && (
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">Development</p>
              <p className="text-sm">{entity.developmentSuggestion}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
