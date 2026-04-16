import type { ScoreInterpretationConfig, BandResult } from '@/lib/reports/types'
import type { PresentationMode } from '@/lib/reports/presentation'
import type { PaletteKey } from '@/lib/reports/band-scheme'
import { BandBadge } from '../charts/band-badge'
import { SegmentBar } from '../charts/segment-bar'

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
  groupEntity: InterpretationEntity | null
  entities: InterpretationEntity[]
}

interface ScoreInterpretationData {
  groups: InterpretationGroup[]
  config: ScoreInterpretationConfig
  palette: PaletteKey
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
  const { config, palette } = d

  return (
    <div className="space-y-6">
      {d.groups.map((group, gi) => (
        <div
          key={gi}
          className="break-inside-avoid print:pt-[8mm] print:pb-[2mm]"
        >
          {group.groupName && (
            <GroupHeader
              group={group}
              config={config}
              palette={palette}
              isFeatured={isFeatured}
            />
          )}
          <div className="space-y-4">
            {group.entities.map((entity) => (
              <InterpretationRow
                key={entity.entityId}
                entity={entity}
                config={config}
                palette={palette}
                isFeatured={isFeatured}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function GroupHeader({
  group,
  config,
  palette,
  isFeatured,
}: {
  group: InterpretationGroup
  config: ScoreInterpretationConfig
  palette: PaletteKey
  isFeatured: boolean
}) {
  const showGroupRow =
    !!group.groupEntity &&
    (config.showGroupScore || config.showGroupBand || config.showGroupAnchors)

  // Subtle accent — a short left-border stripe on the group heading using the
  // report brand accent (partner-branded at runtime, default green otherwise).
  // Marks the heading as "group level" without relying on score colour.
  const accentColour = isFeatured ? 'var(--report-featured-accent)' : 'var(--report-cover-accent)'

  // Plain label — existing behaviour when no group toggles are on.
  if (!showGroupRow) {
    return (
      <div
        className="pl-3 pb-2 mb-3 border-l-4"
        style={{
          borderBottom: `2px solid ${isFeatured ? 'rgba(255,255,255,0.15)' : 'var(--report-divider)'}`,
          borderLeftColor: accentColour,
        }}
      >
        <p
          className="text-[12px] font-bold uppercase tracking-[1.5px]"
          style={{
            color: isFeatured ? 'rgba(255,255,255,0.6)' : 'var(--report-label-colour)',
          }}
        >
          {group.groupName}
        </p>
      </div>
    )
  }

  const entity = group.groupEntity!
  const headingColour = isFeatured ? 'currentColor' : 'var(--report-heading-colour)'
  const mutedColour = isFeatured ? 'rgba(255,255,255,0.5)' : 'var(--report-muted-colour)'
  const hasAnchors = config.showGroupAnchors && (entity.anchorLow || entity.anchorHigh)
  const showBar = config.showGroupScore || config.showGroupBand

  return (
    <div
      className="mb-4 pb-3 pl-3 border-b-2 border-l-4"
      style={{
        borderBottomColor: isFeatured ? 'rgba(255,255,255,0.15)' : 'var(--report-divider)',
        borderLeftColor: accentColour,
      }}
    >
      <div className="flex items-baseline justify-between gap-4 mb-1">
        <span
          className="text-[14px] font-bold uppercase tracking-[1px]"
          style={{ color: headingColour }}
        >
          {entity.entityName}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {config.showGroupBand && (
            <BandBadge
              label={entity.bandResult.bandLabel}
              bandIndex={entity.bandResult.bandIndex}
              bandCount={entity.bandResult.bandCount}
              palette={palette}
            />
          )}
          {config.showGroupScore && (
            <span
              className="text-[15px] font-bold tabular-nums"
              style={{ color: headingColour }}
            >
              {Math.round(entity.pompScore)}
            </span>
          )}
        </div>
      </div>

      {showBar && (
        <SegmentBar
          value={entity.pompScore}
          bandIndex={entity.bandResult.bandIndex}
          bandCount={entity.bandResult.bandCount}
          palette={palette}
          className="mb-1"
        />
      )}

      {hasAnchors && (
        <div className="flex justify-between gap-4 mt-0.5">
          <span className="text-[10px] flex-1" style={{ color: mutedColour }}>
            {entity.anchorLow ?? ''}
          </span>
          <span className="text-[10px] flex-1 text-right" style={{ color: mutedColour }}>
            {entity.anchorHigh ?? ''}
          </span>
        </div>
      )}
    </div>
  )
}

function InterpretationRow({
  entity,
  config,
  palette,
  isFeatured,
}: {
  entity: InterpretationEntity
  config: ScoreInterpretationConfig
  palette: PaletteKey
  isFeatured: boolean
}) {
  const headingColour = isFeatured ? 'currentColor' : 'var(--report-heading-colour)'
  const mutedColour = isFeatured ? 'rgba(255,255,255,0.5)' : 'var(--report-muted-colour)'
  const hasAnchors = config.showAnchors && (entity.anchorLow || entity.anchorHigh)

  return (
    <div>
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
            <BandBadge
              label={entity.bandResult.bandLabel}
              bandIndex={entity.bandResult.bandIndex}
              bandCount={entity.bandResult.bandCount}
              palette={palette}
            />
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

      {/* Row 2: Score bar — uses SegmentBar for consistency with score detail */}
      <SegmentBar
        value={entity.pompScore}
        bandIndex={entity.bandResult.bandIndex}
        bandCount={entity.bandResult.bandCount}
        palette={palette}
        className="mb-1"
      />

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
