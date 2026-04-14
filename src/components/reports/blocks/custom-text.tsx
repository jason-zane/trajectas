import type { PresentationMode, ChartType } from '@/lib/reports/presentation'

interface CustomTextData {
  heading?: string
  content: string
}

export function CustomTextBlock({ data, mode }: { data: Record<string, unknown>; mode?: PresentationMode; chartType?: ChartType }) {
  const d = data as unknown as CustomTextData
  const resolvedMode = mode ?? 'open'

  // In inset mode, the InsetMode wrapper handles the visual treatment
  // Just use CSS vars for colours
  return (
    <div className="space-y-3">
      {d.heading && (
        <h2
          className="text-xl font-semibold"
          style={{
            color: resolvedMode === 'featured'
              ? 'currentColor'
              : 'var(--report-heading-colour)',
          }}
        >
          {d.heading}
        </h2>
      )}
      {/* Content is admin-authored HTML from the rich text editor */}
      <div
        className="prose prose-sm max-w-none"
        style={{
          color: resolvedMode === 'featured'
            ? 'currentColor'
            : 'var(--report-body-colour)',
          opacity: resolvedMode === 'featured' ? 0.85 : 1,
        }}
        dangerouslySetInnerHTML={{ __html: d.content }}
      />
    </div>
  )
}
