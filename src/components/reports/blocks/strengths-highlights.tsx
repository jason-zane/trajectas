import type { PresentationMode, ChartType } from '@/lib/reports/presentation'
import { BandBadge } from '../charts/band-badge'
import type { BandResult } from '@/lib/reports/types'

interface StrengthEntry {
  entityId: string
  entityName: string
  pompScore: number
  narrative?: string
  bandResult?: BandResult
}

interface StrengthsData {
  highlights: StrengthEntry[]
  config: { topN: number; style: 'cards' | 'list' }
  aiNarrative?: string | null
}

export function StrengthsHighlightsBlock({ data, mode }: { data: Record<string, unknown>; mode?: PresentationMode; chartType?: ChartType }) {
  const d = data as unknown as StrengthsData
  if (!d.highlights?.length) return null

  const resolvedMode = mode ?? 'open'

  if (resolvedMode === 'featured') {
    return <FeaturedLayout highlights={d.highlights} aiNarrative={d.aiNarrative} />
  }

  if (resolvedMode === 'carded') {
    return <CardedLayout highlights={d.highlights} aiNarrative={d.aiNarrative} />
  }

  return <OpenLayout highlights={d.highlights} aiNarrative={d.aiNarrative} />
}

/* ---------- AI Narrative Callout ---------- */
function AiNarrativeCallout({ aiNarrative }: { aiNarrative?: string | null }) {
  if (!aiNarrative) return null
  return (
    <div
      className="rounded-xl border p-4 mb-5"
      style={{
        borderColor: 'var(--report-divider)',
        background: 'var(--report-card-bg)',
      }}
    >
      <p className="text-[13px] leading-relaxed" style={{ color: 'var(--report-body-colour)' }}>
        {aiNarrative}
      </p>
    </div>
  )
}

/* ---------- Open: numbered insight columns ---------- */
function OpenLayout({ highlights, aiNarrative }: { highlights: StrengthEntry[]; aiNarrative?: string | null }) {
  return (
    <div>
      <div
        className="text-[10px] uppercase tracking-[2px] mb-5"
        style={{ color: 'var(--report-label-colour)' }}
      >
        Key Strengths
      </div>
      <AiNarrativeCallout aiNarrative={aiNarrative} />
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
            {h.narrative && (
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--report-body-colour)' }}>
                {h.narrative}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------- Carded: ranked cards ---------- */
function CardedLayout({ highlights, aiNarrative }: { highlights: StrengthEntry[]; aiNarrative?: string | null }) {
  return (
    <div>
      <AiNarrativeCallout aiNarrative={aiNarrative} />
      <div className="space-y-3">
        {highlights.map((h, i) => (
          <div
            key={h.entityId}
            className="border rounded-xl p-5 flex gap-4 items-start"
            style={{
              background: 'var(--report-card-bg)',
              borderColor: 'var(--report-card-border)',
            }}
          >
            {/* Rank number */}
            <span
              className="text-2xl font-bold tabular-nums shrink-0"
              style={{ color: 'var(--report-high-band-fill)', opacity: 0.5 }}
            >
              {i + 1}
            </span>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className="text-[15px] font-semibold"
                  style={{ color: 'var(--report-heading-colour)' }}
                >
                  {h.entityName}
                </span>
                {h.bandResult && (
                  <BandBadge band={h.bandResult.band} label={h.bandResult.bandLabel} />
                )}
              </div>
              {h.narrative && (
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--report-body-colour)' }}>
                  {h.narrative}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------- Featured: headline list ---------- */
function FeaturedLayout({ highlights, aiNarrative }: { highlights: StrengthEntry[]; aiNarrative?: string | null }) {
  const names = highlights.map((h) => h.entityName)
  const summary =
    names.length > 1
      ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
      : names[0]

  return (
    <div className="space-y-4">
      <div
        className="text-[10px] uppercase tracking-[2px]"
        style={{ color: 'var(--report-featured-accent)' }}
      >
        Key Strengths
      </div>
      <AiNarrativeCallout aiNarrative={aiNarrative} />
      <p className="text-lg font-semibold text-current">
        {summary}
      </p>
      <ul className="space-y-1">
        {highlights.map((h) => (
          <li key={h.entityId} className="flex items-center gap-2 text-current opacity-80">
            <span className="text-[13px]">{h.entityName}</span>
            <span className="text-[11px] tabular-nums opacity-60">{Math.round(h.pompScore)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
