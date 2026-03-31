const RATER_LABELS: Record<string, string> = {
  self: 'Self',
  manager: 'Manager',
  peers: 'Peers',
  direct_reports: 'Direct Reports',
}

const RATER_COLORS: Record<string, string> = {
  self: 'hsl(var(--primary))',
  manager: 'hsl(var(--chart-2, 210 100% 56%))',
  peers: 'hsl(var(--chart-3, 160 60% 45%))',
  direct_reports: 'hsl(var(--chart-4, 30 80% 55%))',
}

interface RaterEntry {
  entityName: string
  scores: Record<string, number>
}

interface RaterComparisonData {
  entries?: RaterEntry[]
  raterGroups: string[]
  _360?: boolean
}

export function RaterComparisonBlock({ data }: { data: Record<string, unknown> }) {
  const d = data as unknown as RaterComparisonData

  if (d._360 || !d.entries?.length) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground text-sm">
        Rater comparison data will appear here once 360 responses are collected and scored.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Rater Comparison</h3>
      <div className="flex flex-wrap gap-4">
        {d.raterGroups.map((rg) => (
          <div key={rg} className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded-sm" style={{ background: RATER_COLORS[rg] ?? 'hsl(var(--muted-foreground))' }} />
            {RATER_LABELS[rg] ?? rg}
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {d.entries.map((entry) => (
          <div key={entry.entityName} className="space-y-1">
            <p className="text-sm font-medium">{entry.entityName}</p>
            {d.raterGroups.map((rg) => {
              const score = entry.scores[rg]
              if (score === undefined) return null
              return (
                <div key={rg} className="grid grid-cols-[80px_1fr_40px] items-center gap-2">
                  <span className="text-xs text-muted-foreground">{RATER_LABELS[rg] ?? rg}</span>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${score}%`, background: RATER_COLORS[rg] ?? 'hsl(var(--primary))' }} />
                  </div>
                  <span className="text-xs tabular-nums text-right">{Math.round(score)}</span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
