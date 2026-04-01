import type { PresentationMode, ChartType } from '@/lib/reports/presentation'

interface AiTextData {
  generatedText?: string
  promptName?: string
  isPreview?: boolean
  error?: boolean
}

export function AiTextBlock({ data }: { data: Record<string, unknown>; mode?: PresentationMode; chartType?: ChartType }) {
  const d = data as unknown as AiTextData

  // Preview / no content placeholder
  if (d.isPreview || !d.generatedText) {
    return (
      <div
        className="rounded-xl border border-dashed p-6"
        style={{
          borderColor: 'var(--report-divider)',
          background: 'var(--report-card-bg)',
        }}
      >
        <p
          className="text-[13px] italic"
          style={{ color: 'var(--report-muted-colour)' }}
        >
          AI-generated narrative will appear here when the report is generated.
        </p>
      </div>
    )
  }

  // Error state
  if (d.error) {
    return (
      <div
        className="rounded-xl border p-6"
        style={{
          borderColor: 'var(--report-divider)',
          background: 'var(--report-card-bg)',
        }}
      >
        <p
          className="text-[13px]"
          style={{ color: 'var(--report-muted-colour)' }}
        >
          Unable to generate narrative for this section.
        </p>
      </div>
    )
  }

  // Rendered text
  const paragraphs = d.generatedText.split('\n\n').filter(Boolean)

  return (
    <div className="space-y-3">
      {paragraphs.map((paragraph, i) => (
        <p
          key={i}
          className="text-[14px] leading-relaxed"
          style={{ color: 'var(--report-body-colour)' }}
        >
          {paragraph}
        </p>
      ))}
      <span className="text-xs" style={{ color: 'var(--report-muted-colour)' }}>
        AI-generated{d.promptName ? ` \u00b7 ${d.promptName}` : ''}
      </span>
    </div>
  )
}
