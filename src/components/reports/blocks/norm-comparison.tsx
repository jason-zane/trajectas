import type { PresentationMode, ChartType } from '@/lib/reports/presentation'

export function NormComparisonBlock(_props: { data: Record<string, unknown>; mode?: PresentationMode; chartType?: ChartType }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground text-sm">
      Norm comparison data is not yet available. This block will appear once norm groups are configured for this assessment.
    </div>
  )
}
