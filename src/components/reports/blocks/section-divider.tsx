import type { PresentationMode, ChartType } from '@/lib/reports/presentation'

interface SectionDividerData {
  title: string
  subtitle?: string
}

export function SectionDividerBlock({ data, mode }: { data: Record<string, unknown>; mode?: PresentationMode; chartType?: ChartType }) {
  const d = data as unknown as SectionDividerData
  const isFeatured = mode === 'featured'

  return (
    <div
      className="py-8"
      style={{ borderBottom: `1px solid ${isFeatured ? 'rgba(255,255,255,0.15)' : 'var(--report-divider)'}` }}
    >
      <h2
        className="text-2xl font-semibold"
        style={{ color: isFeatured ? 'currentColor' : 'var(--report-heading-colour)' }}
      >
        {d.title}
      </h2>
      {d.subtitle && (
        <p
          className="mt-1"
          style={{ color: isFeatured ? 'currentColor' : 'var(--report-muted-colour)', opacity: isFeatured ? 0.6 : 1 }}
        >
          {d.subtitle}
        </p>
      )}
    </div>
  )
}
