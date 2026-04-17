import type { ScoreInterpretationV2Config } from '@/lib/reports/types'
import type { PresentationMode } from '@/lib/reports/presentation'
import type { PaletteKey, BandDefinition } from '@/lib/reports/band-scheme'
import { BandBadge } from '../charts/band-badge'
import { TickedBar } from '../charts/ticked-bar'

// ---------------------------------------------------------------------------
// Data interfaces (same shape as v1)
// ---------------------------------------------------------------------------

interface InterpretationEntity {
  entityId: string
  entityName: string
  pompScore: number
  bandResult: { bandLabel: string; bandIndex: number; bandCount: number }
  anchorLow: string | null
  anchorHigh: string | null
}

interface InterpretationGroup {
  groupName: string | null
  groupEntity: InterpretationEntity | null
  entities: InterpretationEntity[]
}

interface ScoreInterpretationV2Data {
  groups: InterpretationGroup[]
  config: ScoreInterpretationV2Config
  palette: PaletteKey
  bands: BandDefinition[]
}

/** Shared grid template for bar + flanking anchors — keeps parent and child bars aligned. */
const BAR_GRID = '1fr 65mm 1fr'

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function ScoreInterpretationV2Block({
  data,
  mode,
}: {
  data: Record<string, unknown>
  mode?: PresentationMode
}) {
  const d = data as unknown as ScoreInterpretationV2Data
  if (!d.groups?.length) return null

  const isFeatured = mode === 'featured'
  const { config, palette, bands } = d

  return (
    <div className="space-y-[8mm]">
      {d.groups.map((group, gi) => (
        <div key={gi} className="break-inside-avoid">
          {group.groupName && config.groupByDimension !== false && (
            <GroupHeader
              group={group}
              config={config}
              palette={palette}
              bands={bands}
              isFeatured={isFeatured}
            />
          )}
          <div className={group.groupName && config.groupByDimension !== false ? 'pt-1' : ''}>
            {group.entities.map((entity) => (
              <FactorRow
                key={entity.entityId}
                entity={entity}
                config={config}
                palette={palette}
                bands={bands}
                isFeatured={isFeatured}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Group header (parent row — uppercase name with left accent bar)
// ---------------------------------------------------------------------------

function GroupHeader({
  group,
  config,
  palette,
  bands,
  isFeatured,
}: {
  group: InterpretationGroup
  config: ScoreInterpretationV2Config
  palette: PaletteKey
  bands: BandDefinition[]
  isFeatured: boolean
}) {
  const showExpanded =
    !!group.groupEntity &&
    (config.showGroupScore || config.showGroupBand || config.showGroupAnchors)

  const headingColour = isFeatured ? 'currentColor' : 'var(--report-heading-colour)'
  const brandColour = isFeatured ? 'rgba(255,255,255,0.6)' : 'var(--brand)'

  // Plain label — when no group toggles are on
  if (!showExpanded) {
    return (
      <div className="flex items-center gap-[6px] pb-1 mb-1">
        <span
          className="w-[3px] self-stretch rounded-sm shrink-0"
          style={{ background: brandColour }}
        />
        <p
          className="text-[13.5px] font-bold uppercase tracking-[0.5px]"
          style={{ color: headingColour }}
        >
          {group.groupName}
        </p>
      </div>
    )
  }

  const entity = group.groupEntity!
  const hasAnchors = config.showGroupAnchors && (entity.anchorLow || entity.anchorHigh)
  const showBar = config.showGroupScore || config.showGroupBand

  return (
    <div className="mb-1">
      {/* Name + badge + score — with left accent */}
      <div className="flex items-baseline justify-between gap-4 mb-[3px]">
        <div className="flex items-center gap-[6px]">
          <span
            className="w-[3px] self-stretch rounded-sm shrink-0"
            style={{ background: brandColour }}
          />
          <span
            className="text-[13.5px] font-bold uppercase tracking-[0.5px]"
            style={{ color: headingColour }}
          >
            {entity.entityName}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {config.showGroupBand && (
            <BandBadge
              label={entity.bandResult.bandLabel}
              bandIndex={entity.bandResult.bandIndex}
              bandCount={entity.bandResult.bandCount}
              palette={palette}
              className="!text-[9.5px] !px-2 !py-0.5"
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

      {/* Bar with flanking anchors — same grid as children for alignment */}
      {showBar && (
        <div
          className="grid items-center gap-[3mm]"
          style={{ gridTemplateColumns: BAR_GRID }}
        >
          {hasAnchors && entity.anchorLow ? (
            <span
              className="text-[9px] leading-[1.3] line-clamp-2"
              style={{ color: isFeatured ? 'rgba(255,255,255,0.5)' : '#4b5563' }}
            >
              {entity.anchorLow}
            </span>
          ) : <span />}
          <TickedBar
            value={entity.pompScore}
            bandIndex={entity.bandResult.bandIndex}
            bandCount={entity.bandResult.bandCount}
            palette={palette}
            bands={bands}
            tickColour={isFeatured ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.28)'}
            className="h-[14px]"
          />
          {hasAnchors && entity.anchorHigh ? (
            <span
              className="text-[9px] leading-[1.3] text-right line-clamp-2"
              style={{ color: isFeatured ? 'rgba(255,255,255,0.5)' : '#4b5563' }}
            >
              {entity.anchorHigh}
            </span>
          ) : <span />}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Factor row (child — full width, no indent)
// ---------------------------------------------------------------------------

function FactorRow({
  entity,
  config,
  palette,
  bands,
  isFeatured,
}: {
  entity: InterpretationEntity
  config: ScoreInterpretationV2Config
  palette: PaletteKey
  bands: BandDefinition[]
  isFeatured: boolean
}) {
  const headingColour = isFeatured ? 'currentColor' : 'var(--report-heading-colour)'
  const mutedColour = isFeatured ? 'rgba(255,255,255,0.5)' : 'var(--report-muted-colour)'
  const hasAnchors = config.showAnchors && (entity.anchorLow || entity.anchorHigh)

  return (
    <div className="break-inside-avoid mb-[6px] last:mb-0">
      {/* Name + badge + score */}
      <div className="flex items-baseline justify-between gap-4 mb-[2px]">
        <span
          className="text-[12px] font-semibold"
          style={{ color: headingColour }}
        >
          {entity.entityName}
        </span>
        <div className="flex items-center gap-[6px] shrink-0">
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

      {/* Bar with flanking anchors — same grid as parent for alignment */}
      <div
        className="grid items-center gap-[3mm]"
        style={{ gridTemplateColumns: BAR_GRID }}
      >
        {hasAnchors && entity.anchorLow ? (
          <span
            className="text-[9px] leading-[1.3] line-clamp-2"
            style={{ color: mutedColour }}
          >
            {entity.anchorLow}
          </span>
        ) : <span />}
        <TickedBar
          value={entity.pompScore}
          bandIndex={entity.bandResult.bandIndex}
          bandCount={entity.bandResult.bandCount}
          palette={palette}
          bands={bands}
          tickColour={isFeatured ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.22)'}
          className="h-3"
        />
        {hasAnchors && entity.anchorHigh ? (
          <span
            className="text-[9px] leading-[1.3] text-right line-clamp-2"
            style={{ color: mutedColour }}
          >
            {entity.anchorHigh}
          </span>
        ) : <span />}
      </div>
    </div>
  )
}
