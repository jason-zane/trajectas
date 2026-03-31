import type { PresentationMode, ChartType } from '@/lib/reports/presentation'

interface CommentGroup {
  factorName?: string
  comments: string[]
}

interface OpenCommentsData {
  groups?: CommentGroup[]
  minRatersForDisplay: number
  _360?: boolean
}

export function OpenCommentsBlock({ data, mode }: { data: Record<string, unknown>; mode?: PresentationMode; chartType?: ChartType }) {
  const d = data as unknown as OpenCommentsData
  const resolvedMode = mode ?? 'open'
  const isFeatured = resolvedMode === 'featured'

  if (d._360 || !d.groups?.length) {
    return (
      <div
        className="rounded-lg border border-dashed p-6 text-center text-sm"
        style={{
          borderColor: 'var(--report-divider)',
          color: 'var(--report-muted-colour)',
        }}
      >
        Open comments will appear here once sufficient rater responses are collected (minimum {d.minRatersForDisplay ?? 3} per group for anonymity).
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div
        className="text-[10px] uppercase tracking-[2px]"
        style={{ color: isFeatured ? 'rgba(255,255,255,0.5)' : 'var(--report-label-colour)' }}
      >
        Open Comments
      </div>
      {d.groups.map((group, i) => (
        <div key={i} className="space-y-3">
          {group.factorName && (
            <h4
              className="text-sm font-semibold uppercase tracking-wide"
              style={{ color: isFeatured ? 'currentColor' : 'var(--report-heading-colour)' }}
            >
              {group.factorName}
            </h4>
          )}
          <ul className="space-y-2">
            {group.comments.map((comment, j) => (
              <li
                key={j}
                className="text-sm pl-4 border-l-2"
                style={{
                  borderColor: 'var(--report-inset-border)',
                  color: isFeatured ? 'currentColor' : 'var(--report-body-colour)',
                  opacity: isFeatured ? 0.85 : 1,
                }}
              >
                &ldquo;{comment}&rdquo;
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
