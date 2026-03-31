import type { PresentationMode, ChartType } from '@/lib/reports/presentation'

interface SectionDividerData {
  title: string
  subtitle?: string
}

export function SectionDividerBlock({ data, mode: _mode, chartType: _chartType }: { data: Record<string, unknown>; mode?: PresentationMode; chartType?: ChartType }) {
  const d = data as unknown as SectionDividerData
  return (
    <div className="py-8 border-b border-border">
      <h2 className="text-2xl font-semibold">{d.title}</h2>
      {d.subtitle && <p className="text-muted-foreground mt-1">{d.subtitle}</p>}
    </div>
  )
}
