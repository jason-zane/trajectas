interface CommentGroup {
  factorName?: string
  comments: string[]
}

interface OpenCommentsData {
  groups?: CommentGroup[]
  minRatersForDisplay: number
  _360?: boolean
}

export function OpenCommentsBlock({ data }: { data: Record<string, unknown> }) {
  const d = data as unknown as OpenCommentsData

  if (d._360 || !d.groups?.length) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground text-sm">
        Open comments will appear here once sufficient rater responses are collected (minimum {d.minRatersForDisplay ?? 3} per group for anonymity).
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Open Comments</h3>
      {d.groups.map((group, i) => (
        <div key={i} className="space-y-3">
          {group.factorName && (
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {group.factorName}
            </h4>
          )}
          <ul className="space-y-2">
            {group.comments.map((comment, j) => (
              <li key={j} className="text-sm pl-4 border-l-2 border-muted">
                &ldquo;{comment}&rdquo;
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
