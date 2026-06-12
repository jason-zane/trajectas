import type { PresentationMode, ChartType } from '@/lib/reports/presentation'
import type { BandResult } from '@/lib/reports/types'

// Strengths are already known to be strengths — scores and band labels are
// deliberately not rendered here (they'd be redundant noise on a hero block).

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
    return <ListLayout highlights={d.highlights} dark />
  }

  if (resolvedMode === 'carded') {
    return <CardedLayout highlights={d.highlights} />
  }

  return <OpenLayout highlights={d.highlights} />
}

function getCommentary(h: StrengthEntry): string {
  return h.strengthCommentary || h.definition || 'No commentary available'
}

function Ordinal({ index }: { index: number }) {
  return (
    <span
      className="font-mono text-[12px] font-medium tracking-[0.08em]"
      style={{ color: 'var(--report-featured-accent)' }}
    >
      {String(index + 1).padStart(2, '0')}
    </span>
  )
}

function OpenLayout({ highlights }: { highlights: StrengthEntry[] }) {
  return (
    <div className="report-entry grid grid-cols-1 gap-6 sm:grid-cols-3">
      {highlights.map((h, i) => (
        <div key={h.entityId}>
          <Ordinal index={i} />
          <p
            className="mt-1.5 text-[13.5px] font-bold"
            style={{ color: 'var(--report-heading-colour)' }}
          >
            {h.entityName}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed" style={{ color: 'var(--report-body-colour)' }}>
            {getCommentary(h)}
          </p>
        </div>
      ))}
    </div>
  )
}

function CardedLayout({ highlights }: { highlights: StrengthEntry[] }) {
  return (
    <>
      {highlights.map((h, i) => (
        <div
          key={h.entityId}
          className="report-entry rounded-xl border p-4"
          style={{
            background: 'var(--report-card-bg)',
            borderColor: 'var(--report-card-border)',
          }}
        >
          <Ordinal index={i} />
          <p
            className="mt-1.5 text-[13.5px] font-bold"
            style={{ color: 'var(--report-heading-colour)' }}
          >
            {h.entityName}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed" style={{ color: 'var(--report-body-colour)' }}>
            {getCommentary(h)}
          </p>
        </div>
      ))}
    </>
  )
}

function ListLayout({ highlights, dark }: { highlights: StrengthEntry[]; dark?: boolean }) {
  return (
    <div className="space-y-4">
      {highlights.map((h, i) => (
        <div key={h.entityId} className="flex gap-3.5">
          <Ordinal index={i} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-current">{h.entityName}</p>
            <p
              className="mt-0.5 text-[12px] leading-relaxed"
              style={{ color: dark ? 'rgba(255,255,255,0.7)' : 'var(--report-body-colour)' }}
            >
              {getCommentary(h)}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
