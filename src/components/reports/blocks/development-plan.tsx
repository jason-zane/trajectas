import type { PresentationMode, ChartType } from '@/lib/reports/presentation'

interface DevelopmentItem {
  entityId: string
  entityName: string
  pompScore: number
  suggestion: string | null
}

interface DevelopmentData {
  items: DevelopmentItem[]
  config: { maxItems: number }
}

export function DevelopmentPlanBlock({ data, mode: _mode, chartType: _chartType }: { data: Record<string, unknown>; mode?: PresentationMode; chartType?: ChartType }) {
  const d = data as unknown as DevelopmentData
  if (!d.items?.length) return null

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Development Plan</h3>
      {d.items.map((item, i) => (
        <div key={item.entityId} className="flex gap-4">
          <div className="flex-none w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
            {i + 1}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">{item.entityName}</p>
            {item.suggestion && (
              <p className="text-sm text-muted-foreground">{item.suggestion}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
