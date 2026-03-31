import type { PresentationMode, ChartType } from '@/lib/reports/presentation'

interface CustomTextData {
  heading?: string
  content: string
}

export function CustomTextBlock({ data, mode: _mode, chartType: _chartType }: { data: Record<string, unknown>; mode?: PresentationMode; chartType?: ChartType }) {
  const d = data as unknown as CustomTextData
  return (
    <div className="space-y-3">
      {d.heading && (
        <h2 className="text-xl font-semibold">{d.heading}</h2>
      )}
      <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground whitespace-pre-wrap">
        {d.content}
      </div>
    </div>
  )
}
