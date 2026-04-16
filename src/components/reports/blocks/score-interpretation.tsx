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
        <div key={gi}>
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

  // Plain label — existing behaviour when no group toggles are on.
  if (!showGroupRow) {
    return (
      <p
        className="text-[12px] font-bold uppercase tracking-[1.5px] pb-2 mb-3"
        style={{
          color: isFeatured ? 'rgba(255,255,255,0.6)' : 'var(--report-label-colour)',
          borderBottom: `2px solid ${isFeatured ? 'rgba(255,255,255,0.15)' : 'var(--report-divider)'}`,
        }}
      >
        {group.groupName}
      </p>
    )
  }

  const entity = group.groupEntity!
  const headingColour = isFeatured ? 'currentColor' : 'var(--report-heading-colour)'
  const mutedColour = isFeatured ? 'rgba(255,255,255,0.5)' : 'var(--report-muted-colour)'
  const hasAnchors = config.showGroupAnchors && (entity.anchorLow || entity.anchorHigh)
  const showBar = config.showGroupScore || config.showGroupBand

  return (
    <div
      className="mb-4 pb-3 border-b-2"
      style={{
        borderColor: isFeatured ? 'rgba(255,255,255,0.15)' : 'var(--report-divider)',
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
