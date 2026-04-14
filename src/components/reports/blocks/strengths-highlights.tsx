import type { PresentationMode, ChartType } from '@/lib/reports/presentation'
import type { BandResult } from '@/lib/reports/types'

interface StrengthEntry {
  entityId: string
  entityName: string
  pompScore: number
  strengthCommentary?: string
  definition?: string
  bandResult?: BandResult
}

interface StrengthsData {
  highlights: StrengthEntry[]
  config: { topN: number }
}

export function StrengthsHighlightsBlock({ data, mode }: { data: Record<string, unknown>; mode?: PresentationMode; chartType?: ChartType }) {
  const d = data as unknown as StrengthsData
  if (!d.highlights?.length) return null

  const resolvedMode = mode ?? 'open'

  if (resolvedMode === 'featured') {
    return <FeaturedLayout highlights={d.highlights} />
  }

  if (resolvedMode === 'carded') {
    return <CardedLayout highlights={d.highlights} />
  }

  return <OpenLayout highlights={d.highlights} />
}

function getCommentary(h: StrengthEntry): string {
  return h.strengthCommentary || h.definition || 'No commentary available'
}

/* ---------- Open: numbered insight columns ---------- */
function OpenLayout({ highlights }: { highlights: StrengthEntry[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
      {highlights.map((h, i) => (
        <div key={h.entityId} className="space-y-2">
          <span
            className="text-[40px] font-bold leading-none"
            style={{ color: 'var(--report-high-band-fill)', opacity: 0.25 }}
          >
            {String(i + 1).padStart(2, '0')}
          </span>
          <p
            className="text-[15px] font-semibold"
            style={{ color: 'var(--report-heading-colour)' }}
          >
            {h.entityName}
          </p>
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--report-body-colour)' }}>
            {getCommentary(h)}
          </p>
        </div>
      ))}
    </div>
  )
}

/* ---------- Carded: ranked cards ---------- */
function CardedLayout({ highlights }: { highlights: StrengthEntry[] }) {
  return (
    <>
      {highlights.map((h, i) => (
        <div
          key={h.entityId}
          className="border rounded-xl p-5 flex gap-4 items-start"
          style={{
            background: 'var(--report-card-bg)',
            borderColor: 'var(--report-card-border)',
          }}
        >
          <span
            className="text-2xl font-bold tabular-nums shrink-0"
            style={{ color: 'var(--report-high-band-fill)', opacity: 0.5 }}
          >
            {String(i + 1).padStart(2, '0')}
          </span>
          <div className="flex-1 space-y-1">
            <span
              className="text-[15px] font-semibold"
              style={{ color: 'var(--report-heading-colour)' }}
            >
              {h.entityName}
            </span>
            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--report-body-colour)' }}>
              {getCommentary(h)}
            </p>
          </div>
        </div>
      ))}
    </>
  )
}

/* ---------- Featured: compact list ---------- */
function FeaturedLayout({ highlights }: { highlights: StrengthEntry[] }) {
  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {highlights.map((h) => (
          <li key={h.entityId} className="text-current">
            <span className="text-[13px] font-medium">{h.entityName}</span>
            <p className="text-[12px] leading-relaxed opacity-75 mt-0.5">
              {getCommentary(h)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
