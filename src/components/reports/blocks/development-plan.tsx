import type { PresentationMode, ChartType } from '@/lib/reports/presentation'
import type { BandResult } from '@/lib/reports/types'

interface DevelopmentItem {
  entityId: string
  entityName: string
  pompScore: number
  bandResult?: BandResult
  parentName?: string
  developmentSuggestion?: string | null
  definition?: string
  relatedFactor?: string
}

interface DevelopmentData {
  items: DevelopmentItem[]
  config: { maxItems: number; showCommitments?: boolean; commitmentLines?: number }
}

export function DevelopmentPlanBlock({ data, mode }: { data: Record<string, unknown>; mode?: PresentationMode; chartType?: ChartType }) {
  const d = data as unknown as DevelopmentData
  if (!d.items?.length) return null

  const isDark = mode === 'featured'

  return (
    <div>
      <div className="space-y-5">
        {d.items.map((item, i) => (
          <div key={item.entityId} className="report-entry flex gap-3.5">
            <span
              className="shrink-0 font-mono text-[15px] leading-snug"
              style={{ color: 'var(--report-featured-accent)' }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className="text-[13.5px] font-semibold"
                style={{ color: isDark ? 'currentColor' : 'var(--report-heading-colour)' }}
              >
                {item.entityName}
              </p>
              <MetaLine item={item} isDark={isDark} />
              <p
                className="mt-1.5 text-[12.5px] leading-relaxed"
                style={{ color: isDark ? 'rgba(255,255,255,0.75)' : 'var(--report-body-colour)' }}
              >
                {getSuggestion(item)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {d.config?.showCommitments && (
        <div
          className="report-entry mt-6 rounded-lg px-4 py-3.5"
          style={{
            background: isDark ? 'rgba(255,255,255,0.08)' : 'var(--report-inset-bg)',
          }}
        >
          <p
            className="mb-3 font-mono text-[10px] font-medium tracking-[0.18em]"
            style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'var(--report-muted-colour)' }}
          >
            MY COMMITMENTS
          </p>
          {Array.from({ length: d.config.commitmentLines ?? 3 }).map((_, i) => (
            <div
              key={i}
              className="h-6 border-b"
              style={{ borderColor: isDark ? 'rgba(255,255,255,0.25)' : 'var(--report-card-border)' }}
            />
          ))}
          <p
            className="mt-2 text-[11px]"
            style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'var(--report-muted-colour)' }}
          >
            To revisit with your coach or manager in 90 days.
          </p>
        </div>
      )}
    </div>
  )
}

function MetaLine({ item, isDark }: { item: DevelopmentItem; isDark: boolean }) {
  const parts: string[] = []
  const parent = item.parentName || item.relatedFactor
  if (parent) parts.push(parent.toUpperCase())
  parts.push(String(Math.round(item.pompScore)))
  if (item.bandResult?.bandLabel) parts.push(item.bandResult.bandLabel.toUpperCase())

  return (
    <p
      className="mt-0.5 font-mono text-[10px] tracking-[0.12em]"
      style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'var(--report-muted-colour)' }}
    >
      {parts.join(' · ')}
    </p>
  )
}

function getSuggestion(item: DevelopmentItem): string {
  return item.developmentSuggestion || item.definition || 'No development suggestion available'
}
