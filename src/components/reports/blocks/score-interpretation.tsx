import type { ScoreInterpretationConfig, BandResult } from '@/lib/reports/types'
import type { PresentationMode } from '@/lib/reports/presentation'
import { BandBadge } from '../charts/band-badge'

interface InterpretationEntity {
  entityId: string
  entityName: string
  pompScore: number
  bandResult: BandResult
  anchorLow: string | null
  anchorHigh: string | null
}

interface InterpretationGroup {
  groupName: string | null
  entities: InterpretationEntity[]
}

interface ScoreInterpretationData {
  groups: InterpretationGroup[]
  config: ScoreInterpretationConfig
}

export function ScoreInterpretationBlock({
  data,
  mode,
}: {
  data: Record<string, unknown>
  mode?: PresentationMode
}) {
  const d = data as unknown as ScoreInterpretationData
  if (!d.groups?.length) return null

  const isFeatured = mode === 'featured'
  const { config } = d

  return (
    <div className="space-y-6">
      {d.groups.map((group, gi) => (
        <div key={gi}>
          {group.groupName && (
            <p
              className="text-[12px] font-bold uppercase tracking-[1.5px] pb-2 mb-3"
              style={{
                color: isFeatured ? 'rgba(255,255,255,0.6)' : 'var(--report-label-colour)',
                borderBottom: `2px solid ${isFeatured ? 'rgba(255,255,255,0.15)' : 'var(--report-divider)'}`,
              }}
            >
              {group.groupName}
            </p>
          )}
          <div className="space-y-4">
            {group.entities.map((entity) => (
              <InterpretationRow
                key={entity.entityId}
                entity={entity}
                config={config}
                isFeatured={isFeatured}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

const BAND_COLOURS: Record<string, { light: string; dark: string }> = {
  high: { light: '#2e7d32', dark: '#6ee7a0' },
  mid: { light: '#e67a00', dark: '#f0c060' },
  low: { light: '#c62828', dark: '#f08080' },
}

function InterpretationRow({
  entity,
  config,
  isFeatured,
}: {
  entity: InterpretationEntity
  config: ScoreInterpretationConfig
  isFeatured: boolean
}) {
  const headingColour = isFeatured ? 'currentColor' : 'var(--report-heading-colour)'
  const mutedColour = isFeatured ? 'rgba(255,255,255,0.5)' : 'var(--report-muted-colour)'
  const barBg = isFeatured ? 'rgba(255,255,255,0.15)' : 'var(--report-divider)'
  const hasAnchors = config.showAnchors && (entity.anchorLow || entity.anchorHigh)
  const colours = BAND_COLOURS[entity.bandResult.band] ?? BAND_COLOURS.mid
  const barColour = isFeatured ? colours.dark : colours.light

  return (
    <div className="break-inside-avoid">
      {/* Row 1: Name + badge + score */}
      <div className="flex items-baseline justify-between gap-4 mb-1">
        <span
          className="text-[12px] font-semibold"
          style={{ color: headingColour }}
        >
          {entity.entityName}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {config.showBandLabel && (
            <BandBadge band={entity.bandResult.band} label={entity.bandResult.bandLabel} />
          )}
          {config.showScore && (
            <span
              className="text-[13px] font-bold tabular-nums"
              style={{ color: headingColour }}
            >
              {Math.round(entity.pompScore)}
            </span>
          )}
        </div>
      </div>

      {/* Row 2: Full-width bar with score marker */}
      <div
        className="relative h-[6px] rounded-full mb-1"
        style={{ background: barBg }}
      >
        <div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{
            width: `${Math.round(entity.pompScore)}%`,
            background: barColour,
            opacity: isFeatured ? 0.8 : 0.7,
          }}
        />
        <div
          className="absolute top-1/2 w-[10px] h-[10px] rounded-full shadow-sm"
          style={{
            left: `${Math.round(entity.pompScore)}%`,
            transform: 'translate(-50%, -50%)',
            background: barColour,
          }}
        />
      </div>

      {/* Row 3: Anchors (optional) */}
      {hasAnchors && (
        <div className="flex justify-between gap-4 mt-0.5">
          <span className="text-[9px] flex-1" style={{ color: mutedColour }}>
            {entity.anchorLow ?? ''}
          </span>
          <span className="text-[9px] flex-1 text-right" style={{ color: mutedColour }}>
            {entity.anchorHigh ?? ''}
          </span>
        </div>
      )}
    </div>
  )
}
