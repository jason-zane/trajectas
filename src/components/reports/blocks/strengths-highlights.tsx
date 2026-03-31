import type { PresentationMode, ChartType } from '@/lib/reports/presentation'

interface StrengthEntry {
  entityId: string
  entityName: string
  pompScore: number
}

interface StrengthsData {
  highlights: StrengthEntry[]
  config: { topN: number; style: 'cards' | 'list' }
}

export function StrengthsHighlightsBlock({ data, mode: _mode, chartType: _chartType }: { data: Record<string, unknown>; mode?: PresentationMode; chartType?: ChartType }) {
  const d = data as unknown as StrengthsData
  if (!d.highlights?.length) return null

  if (d.config.style === 'cards') {
    return (
      <div>
        <h3 className="text-lg font-semibold mb-4">Key Strengths</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {d.highlights.map((h) => (
            <div
              key={h.entityId}
              className="rounded-xl border border-border bg-card p-4 text-center space-y-2"
            >
              <p className="text-2xl font-bold text-primary tabular-nums">
                {Math.round(h.pompScore)}
              </p>
              <p className="text-sm font-medium">{h.entityName}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Key Strengths</h3>
      <ul className="space-y-2">
        {d.highlights.map((h, i) => (
          <li key={h.entityId} className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground w-5">{i + 1}.</span>
            <span className="text-sm font-medium flex-1">{h.entityName}</span>
            <span className="text-sm tabular-nums text-primary font-semibold">
              {Math.round(h.pompScore)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
