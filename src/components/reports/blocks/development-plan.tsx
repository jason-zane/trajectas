import type { PresentationMode, ChartType } from '@/lib/reports/presentation'

interface DevelopmentItem {
  entityId: string
  entityName: string
  pompScore: number
  developmentSuggestion?: string | null
  definition?: string
  relatedFactor?: string
}

interface DevelopmentData {
  items: DevelopmentItem[]
  config: { maxItems: number }
}

export function DevelopmentPlanBlock({ data, mode }: { data: Record<string, unknown>; mode?: PresentationMode; chartType?: ChartType }) {
  const d = data as unknown as DevelopmentData
  if (!d.items?.length) return null

  const resolvedMode = mode ?? 'open'

  if (resolvedMode === 'carded') {
    return <CardedLayout items={d.items} />
  }

  if (resolvedMode === 'featured') {
    return <FeaturedLayout items={d.items} />
  }

  return <TimelineLayout items={d.items} />
}

function getSuggestion(item: DevelopmentItem): string {
  return item.developmentSuggestion || item.definition || 'No development suggestion available'
}

/* ---------- Open: timeline layout ---------- */
function TimelineLayout({ items }: { items: DevelopmentItem[] }) {
  return (
    <div>
      <div
        className="text-[10px] uppercase tracking-[2px] mb-5"
        style={{ color: 'var(--report-label-colour)' }}
      >
        Development Plan
      </div>

      <div className="relative pl-8">
        {/* Vertical connector line */}
        <div
          className="absolute left-[9px] top-2 bottom-2 w-px"
          style={{ background: 'var(--report-divider)' }}
        />

        {items.map((item, i) => (
          <div key={item.entityId} className="relative mb-6 last:mb-0">
            {/* Dot */}
            <div
              className="absolute -left-8 top-1 w-[18px] h-[18px] rounded-full border-[3px]"
              style={{
                borderColor: i === 0 ? 'var(--report-high-band-fill)' : 'var(--report-mid-band-fill)',
                background: i === 0 ? 'var(--report-high-band-fill)' : 'transparent',
              }}
            />

            {/* Content */}
            <div className="space-y-1">
              <p
                className="text-[15px] font-semibold"
                style={{ color: 'var(--report-heading-colour)' }}
              >
                {item.entityName}
              </p>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--report-body-colour)' }}>
                {getSuggestion(item)}
              </p>
              {item.relatedFactor && (
                <span
                  className="inline-block text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded mt-1"
                  style={{
                    background: 'var(--report-card-bg)',
                    color: 'var(--report-muted-colour)',
                    border: '1px solid var(--report-divider)',
                  }}
                >
                  {item.relatedFactor}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------- Carded: numbered icon cards ---------- */
function CardedLayout({ items }: { items: DevelopmentItem[] }) {
  return (
    <div>
      <div
        className="text-[10px] uppercase tracking-[2px] mb-5"
        style={{ color: 'var(--report-label-colour)' }}
      >
        Development Plan
      </div>

      <div className="space-y-3">
        {items.map((item, i) => (
          <div
            key={item.entityId}
            className="border rounded-xl p-5 flex gap-4 items-start"
            style={{
              background: 'var(--report-card-bg)',
              borderColor: 'var(--report-card-border)',
            }}
          >
            {/* Number badge */}
            <span
              className="text-[22px] font-bold tabular-nums shrink-0"
              style={{ color: 'var(--report-mid-band-fill)', opacity: 0.5 }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>

            <div className="flex-1 space-y-1">
              <p
                className="text-[15px] font-semibold"
                style={{ color: 'var(--report-heading-colour)' }}
              >
                {item.entityName}
              </p>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--report-body-colour)' }}>
                {getSuggestion(item)}
              </p>
              {item.relatedFactor && (
                <span
                  className="inline-block text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded mt-1"
                  style={{
                    background: 'var(--report-card-bg)',
                    color: 'var(--report-muted-colour)',
                    border: '1px solid var(--report-divider)',
                  }}
                >
                  {item.relatedFactor}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------- Featured: compact list ---------- */
function FeaturedLayout({ items }: { items: DevelopmentItem[] }) {
  return (
    <div className="space-y-4">
      <div
        className="text-[10px] uppercase tracking-[2px]"
        style={{ color: 'var(--report-featured-accent)' }}
      >
        Development Plan
      </div>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.entityId} className="text-current">
            <span className="text-[13px] font-medium">{item.entityName}</span>
            <p className="text-[12px] leading-relaxed opacity-75 mt-0.5">
              {getSuggestion(item)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
