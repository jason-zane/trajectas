interface GapItem {
  entityName: string
  selfScore: number
  othersScore: number
  gap: number
  type: 'blind_spot' | 'hidden_strength'
}

interface GapAnalysisData {
  blindSpots?: GapItem[]
  hiddenStrengths?: GapItem[]
  _360?: boolean
}

export function GapAnalysisBlock({ data }: { data: Record<string, unknown> }) {
  const d = data as GapAnalysisData

  if (d._360 || (!d.blindSpots?.length && !d.hiddenStrengths?.length)) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground text-sm">
        Gap analysis will appear here once 360 responses are collected and scored.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {d.blindSpots && d.blindSpots.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-amber-600">Potential Blind Spots</h4>
          <p className="text-xs text-muted-foreground">Areas where self-rating exceeds others&apos; ratings</p>
          {d.blindSpots.map((item) => (
            <div key={item.entityName} className="flex items-center justify-between text-sm">
              <span>{item.entityName}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                Self: {Math.round(item.selfScore)} · Others: {Math.round(item.othersScore)}
              </span>
            </div>
          ))}
        </div>
      )}
      {d.hiddenStrengths && d.hiddenStrengths.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-emerald-600">Hidden Strengths</h4>
          <p className="text-xs text-muted-foreground">Areas where others rate higher than self-rating</p>
          {d.hiddenStrengths.map((item) => (
            <div key={item.entityName} className="flex items-center justify-between text-sm">
              <span>{item.entityName}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                Self: {Math.round(item.selfScore)} · Others: {Math.round(item.othersScore)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
